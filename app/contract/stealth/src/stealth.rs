use soroban_sdk::{token, Address, Bytes, BytesN, Env};

use stellar_dao_shared::{
    errors::StellarBasicDAOError,
    events,
    storage::{
        get_stealth_escrow, get_stealth_total_balance, put_stealth_escrow, remove_stealth_escrow,
        require_stealth_balance_invariant,
    },
    types::{EscrowStatus, StealthDepositParams, StealthEscrowEntry},
};

// ---------------------------------------------------------------------------
// Key-derivation helpers
// ---------------------------------------------------------------------------

/// Derive a 32-byte shared secret from two 32-byte public-key blobs.
///
/// `KDF(a, b) = SHA-256(a || b)`
///
/// In a production implementation this would be replaced by proper EC scalar
/// multiplication (e.g. `eph_priv * scan_pub` on secp256k1).
pub fn derive_shared_secret(env: &Env, key_a: &BytesN<32>, key_b: &BytesN<32>) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&Bytes::from(key_a.clone()));
    payload.append(&Bytes::from(key_b.clone()));
    env.crypto().sha256(&payload).into()
}

/// Derive the one-time stealth address from a spend key and a shared secret.
///
/// `stealth = SHA-256(spend_pub || shared_secret)`
pub fn derive_stealth_address(
    env: &Env,
    spend_pub: &BytesN<32>,
    shared_secret: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&Bytes::from(spend_pub.clone()));
    payload.append(&Bytes::from(shared_secret.clone()));
    env.crypto().sha256(&payload).into()
}

/// Validate a stealth deposit timeout and compute its `expires_at`.
///
/// Mirrors the escrow contract's INV-3 guard: a timeout so large that
/// `now + timeout_secs` saturates would create a never-expiring escrow.
/// Since stealth escrows have no refund path, such funds would be locked
/// permanently, so we reject the timeout up front.
fn compute_expires_at(now: u64, timeout_secs: u64) -> Result<u64, StellarBasicDAOError> {
    if timeout_secs == 0 {
        return Ok(0); // non-expiring
    }
    let expires_at = now.saturating_add(timeout_secs);
    if expires_at == u64::MAX {
        return Err(StellarBasicDAOError::InvalidTimeout);
    }
    Ok(expires_at)
}

// ---------------------------------------------------------------------------
// register_ephemeral_key
// ---------------------------------------------------------------------------

/// Register an ephemeral public key and lock funds for a stealth recipient.
///
/// The sender provides:
/// - `stealth_address` – the one-time address derived off-chain via DH.
/// - `eph_pub`         – the sender's ephemeral public key (32 bytes).
/// - `spend_pub`       – recipient's spend public key (32 bytes).
///
/// The contract re-derives the stealth address on-chain to verify the sender's
/// computation, then locks `amount` of `token` under that stealth address.
///
/// # Errors
/// - [`InvalidAmount`]            – amount ≤ 0.
/// - [`StealthAddressMismatch`]   – on-chain re-derivation does not match `stealth_address`.
/// - [`StealthAddressAlreadyUsed`]– a deposit already exists for this stealth address.
pub fn register_ephemeral_key(
    env: &Env,
    params: StealthDepositParams,
) -> Result<BytesN<32>, StellarBasicDAOError> {
    let StealthDepositParams {
        sender,
        token,
        amount_due,
        amount_paid,
        eph_pub,
        spend_pub,
        stealth_address,
        timeout_secs,
    } = params;

    if amount_due <= 0 || amount_paid <= 0 {
        return Err(StellarBasicDAOError::InvalidAmount);
    }

    if amount_paid > amount_due {
        return Err(StellarBasicDAOError::Overpayment);
    }

    sender.require_auth();

    // Re-derive on-chain to verify sender's computation.
    // shared_secret = KDF(eph_pub || spend_pub)
    let shared_secret = derive_shared_secret(env, &eph_pub, &spend_pub);
    // stealth = KDF(spend_pub || shared_secret)
    let expected_stealth = derive_stealth_address(env, &spend_pub, &shared_secret);

    if expected_stealth != stealth_address {
        return Err(StellarBasicDAOError::StealthAddressMismatch);
    }

    // Reject duplicate stealth addresses (replay protection).
    if get_stealth_escrow(env, &stealth_address).is_some() {
        return Err(StellarBasicDAOError::CommitmentAlreadyExists);
    }

    // Validate balance invariant before state transition
    let balance_before = get_stealth_total_balance(env);

    // Transfer funds from sender to contract.
    let token_client = token::Client::new(env, &token);
    let contract_addr = env.current_contract_address();
    token_client.transfer(&sender, &contract_addr, &amount_paid);

    // Validate balance invariant after transfer
    // The contract should now hold `amount_paid` additional tokens
    require_stealth_balance_invariant(env, balance_before.saturating_add(amount_paid), false)?;

    let now = env.ledger().timestamp();
    let expires_at = compute_expires_at(now, timeout_secs)?;

    let entry = StealthEscrowEntry {
        token: token.clone(),
        amount_due,
        amount_paid,
        eph_pub: eph_pub.clone(),
        status: EscrowStatus::Pending,
        created_at: now,
        expires_at,
        schema_version: stellar_dao_shared::types::STEALTH_ESCROW_SCHEMA_VERSION,
    };

    put_stealth_escrow(env, &stealth_address, &entry);

    events::publish_ephemeral_key_registered(
        env,
        stealth_address.clone(),
        eph_pub,
        token,
        amount_due,
        amount_paid,
        expires_at,
    );

    Ok(stealth_address)
}

// ---------------------------------------------------------------------------
// stealth_withdraw
// ---------------------------------------------------------------------------

/// Withdraw funds locked under a stealth address.
///
/// The caller proves ownership by supplying the `spend_pub` key and the
/// `eph_pub` from the registration event.  The contract re-derives the
/// stealth address and, if it matches, transfers funds to `recipient`.
///
/// The `recipient` address is the caller's *real* on-chain address for
/// receiving the tokens – it is only revealed at withdrawal time and is
/// not linked to the original stealth address in any prior transaction.
///
/// # Errors
/// - [`StealthEscrowNotFound`]  – no escrow for this stealth address.
/// - [`AlreadySpent`]           – escrow already withdrawn or refunded.
/// - [`EscrowExpired`]          – escrow has passed its expiry.
/// - [`StealthAddressMismatch`] – re-derived address does not match.
/// - [`InternalError`]          – balance invariant violated after withdrawal.
pub fn stealth_withdraw(
    env: &Env,
    recipient: Address,
    eph_pub: BytesN<32>,
    spend_pub: BytesN<32>,
    stealth_address: BytesN<32>,
) -> Result<bool, StellarBasicDAOError> {
    recipient.require_auth();

    let entry = get_stealth_escrow(env, &stealth_address)
        .ok_or(StellarBasicDAOError::CommitmentNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(StellarBasicDAOError::AlreadySpent);
    }

    if entry.expires_at > 0 && env.ledger().timestamp() >= entry.expires_at {
        return Err(StellarBasicDAOError::EscrowExpired);
    }

    // Validate the stored amount before proceeding
    if entry.amount_paid <= 0 {
        return Err(StellarBasicDAOError::InvalidAmount);
    }

    // Verify the caller knows the correct spend_pub for this stealth address.
    let shared_secret = derive_shared_secret(env, &eph_pub, &spend_pub);
    let expected_stealth = derive_stealth_address(env, &spend_pub, &shared_secret);

    if expected_stealth != stealth_address {
        return Err(StellarBasicDAOError::StealthAddressMismatch);
    }

    // Validate balance invariant before withdrawal
    let balance_before = get_stealth_total_balance(env);

    // Transfer funds to recipient.
    let token_client = token::Client::new(env, &entry.token);
    token_client.transfer(
        &env.current_contract_address(),
        &recipient,
        &entry.amount_paid,
    );

    // Verify balance invariant after withdrawal
    // The contract should have released `entry.amount_paid` tokens
    require_stealth_balance_invariant(
        env,
        balance_before.saturating_sub(entry.amount_paid),
        false,
    )?;

    // Cleanup terminal entry after successful withdrawal (INV-S-4)
    remove_stealth_escrow(env, &stealth_address);

    events::publish_stealth_withdrawn(
        env,
        stealth_address,
        recipient,
        entry.token,
        entry.amount_paid,
    );

    Ok(true)
}

// ---------------------------------------------------------------------------
// get_stealth_escrow_status (read-only)
// ---------------------------------------------------------------------------

/// Return the status of a stealth escrow without revealing sensitive fields.
///
/// Returns `None` if no escrow exists for the given stealth address.
pub fn get_stealth_status(env: &Env, stealth_address: &BytesN<32>) -> Option<EscrowStatus> {
    get_stealth_escrow(env, stealth_address).map(|e| e.status)
}

// ---------------------------------------------------------------------------
// cleanup_stealth_escrow
// ---------------------------------------------------------------------------

/// Remove a terminal (withdrawn/refunded) stealth escrow entry to reclaim its
/// storage deposit (Issue #51).
///
/// Only entries in `Spent` or `Refunded` status may be removed; an attempt to
/// clean a still-`Pending` entry returns [`AlreadySpent`](StellarBasicDAOError::AlreadySpent)
/// and leaves storage untouched. After removal, [`get_stealth_status`] and
/// [`get_stealth_escrow`](stellar_dao_shared::storage::get_stealth_escrow) return `None`, so
/// no stale lookup can resolve to the cleaned address. O(1) — no state scan.
///
/// # Errors
/// - [`StealthEscrowNotFound`](StellarBasicDAOError::CommitmentNotFound) – no entry for the address.
/// - [`AlreadySpent`](StellarBasicDAOError::AlreadySpent) – entry is not in a terminal state.
/// - [`InternalError`] – balance invariant check fails for stale entry.
pub fn cleanup_stealth_escrow(
    env: &Env,
    stealth_address: BytesN<32>,
) -> Result<(), StellarBasicDAOError> {
    let entry = get_stealth_escrow(env, &stealth_address)
        .ok_or(StellarBasicDAOError::CommitmentNotFound)?;

    match entry.status {
        EscrowStatus::Spent | EscrowStatus::Refunded => {
            // Validate no orphaned balance before cleanup (INV-S-1)
            if entry.amount_paid != 0 {
                // This should never happen - indicates corrupted state
                return Err(StellarBasicDAOError::InternalError);
            }
            remove_stealth_escrow(env, &stealth_address);
            events::publish_stealth_escrow_cleaned(env, stealth_address);
            Ok(())
        }
        _ => Err(StellarBasicDAOError::AlreadySpent),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_expires_at_zero_timeout_means_non_expiring() {
        assert_eq!(compute_expires_at(1000, 0).unwrap(), 0);
    }

    #[test]
    fn compute_expires_at_adds_timeout_to_now() {
        assert_eq!(compute_expires_at(1000, 3600).unwrap(), 4600);
    }

    #[test]
    fn compute_expires_at_rejects_saturating_timeouts() {
        // A timeout large enough that now + timeout saturates to u64::MAX
        // would create a never-expiring escrow with no refund path.
        let err = compute_expires_at(1000, u64::MAX)
            .expect_err("overflowing timeout must be rejected");
        assert_eq!(err, StellarBasicDAOError::InvalidTimeout);
    }
}
