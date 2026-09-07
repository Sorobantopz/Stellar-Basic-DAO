#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, Vec};

mod admin;
mod batch;
mod dispute;
mod escrow;
mod fee;
mod fee_router;
mod hook;
mod oracle;
mod privacy;

use stellar_dao_shared::errors::StellarBasicDAOError;
use stellar_dao_shared::types::PrivacyAwareEscrowView;

/// Stellar Basic DAO — Core Escrow Sub-contract
///
/// Handles deposit, withdrawal (with privacy-aware views), refund, dispute
/// lifecycle, escrow TTL management, cleanup, and batch escrow operations.
/// Fee routing is delegated to the Fee sub-contract via cross-contract calls.
#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // ── Deposit ──────────────────────────────────────────────────────

    pub fn deposit(
        env: Env,
        token: Address,
        amount: i128,
        owner: Address,
        salt: Bytes,
        timeout_secs: u64,
        arbiter: Option<Address>,
    ) -> Result<BytesN<32>, StellarBasicDAOError> {
        escrow::deposit(&env, token, amount, owner, salt, timeout_secs, arbiter)
    }

    pub fn deposit_with_commitment(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
        commitment: BytesN<32>,
        timeout_secs: u64,
        arbiter: Option<Address>,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::deposit_with_commitment(
            &env,
            from,
            token,
            amount,
            commitment,
            timeout_secs,
            arbiter,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn deposit_partial(
        env: Env,
        token: Address,
        amount_due: i128,
        initial_payment: i128,
        owner: Address,
        salt: Bytes,
        timeout_secs: u64,
        arbiter: Option<Address>,
    ) -> Result<BytesN<32>, StellarBasicDAOError> {
        escrow::deposit_partial(
            &env,
            token,
            amount_due,
            initial_payment,
            owner,
            salt,
            timeout_secs,
            arbiter,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn deposit_with_arbiters(
        env: Env,
        token: Address,
        amount: i128,
        owner: Address,
        salt: Bytes,
        timeout_secs: u64,
        arbiters: Vec<Address>,
        threshold: u32,
    ) -> Result<BytesN<32>, StellarBasicDAOError> {
        escrow::deposit_with_arbiters(
            &env,
            token,
            amount,
            owner,
            salt,
            timeout_secs,
            arbiters,
            threshold,
        )
    }

    pub fn partial_payment(
        env: Env,
        commitment: BytesN<32>,
        payer: Address,
        payment_amount: i128,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::partial_payment(&env, commitment, payer, payment_amount)
    }

    // ── Withdraw & Refund ────────────────────────────────────────────

    pub fn withdraw(
        env: Env,
        _token: Address,
        amount: i128,
        _commitment: BytesN<32>,
        to: Address,
        salt: Bytes,
    ) -> Result<bool, StellarBasicDAOError> {
        escrow::withdraw(&env, amount, to, salt)
    }

    pub fn refund(
        env: Env,
        commitment: BytesN<32>,
        caller: Address,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::refund(&env, commitment, caller)
    }

    // ── Dispute ──────────────────────────────────────────────────────

    pub fn dispute(env: Env, commitment: BytesN<32>) -> Result<(), StellarBasicDAOError> {
        escrow::dispute(&env, commitment)
    }

    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        commitment: BytesN<32>,
        resolve_for_owner: bool,
        recipient: Address,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::resolve_dispute(&env, caller, commitment, resolve_for_owner, recipient)
    }

    pub fn vote_for_dispute(
        env: Env,
        caller: Address,
        commitment: BytesN<32>,
        resolve_for_owner: bool,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::vote_for_dispute(&env, caller, commitment, resolve_for_owner)
    }

    pub fn resolve_dispute_multi_sig(
        env: Env,
        commitment: BytesN<32>,
        recipient: Address,
    ) -> Result<(), StellarBasicDAOError> {
        escrow::resolve_dispute_multi_sig(&env, commitment, recipient)
    }

    // ── TTL & Cleanup ────────────────────────────────────────────────

    pub fn extend_escrow_ttl(env: Env, commitment: BytesN<32>) -> Result<(), StellarBasicDAOError> {
        escrow::extend_escrow_ttl(&env, commitment)
    }

    pub fn cleanup_escrow(env: Env, commitment: BytesN<32>) -> Result<(), StellarBasicDAOError> {
        escrow::cleanup_escrow(&env, commitment)
    }

    // ── Privacy ──────────────────────────────────────────────────────

    pub fn set_privacy(
        env: Env,
        owner: Address,
        enabled: bool,
    ) -> Result<(), StellarBasicDAOError> {
        privacy::set_privacy(&env, owner, enabled)
    }

    pub fn get_privacy(env: Env, owner: Address) -> bool {
        privacy::get_privacy(&env, owner)
    }

    pub fn get_escrow_details(
        env: Env,
        commitment: BytesN<32>,
        caller: Address,
    ) -> Option<PrivacyAwareEscrowView> {
        let commitment_bytes: Bytes = commitment.into();
        let entry = stellar_dao_shared::storage::get_escrow(&env, &commitment_bytes)?;
        let privacy_on = privacy::get_privacy(&env, entry.owner.clone());
        let is_owner = caller == entry.owner;
        let is_arbiter = entry.arbiter.as_ref().is_some_and(|a| caller == *a);
        let show_sensitive = !privacy_on || is_owner || is_arbiter;
        if show_sensitive {
            Some(PrivacyAwareEscrowView {
                token: entry.token,
                amount_due: Some(entry.amount_due),
                amount_paid: Some(entry.amount_paid),
                owner: Some(entry.owner),
                status: entry.status,
                created_at: entry.created_at,
                expires_at: entry.expires_at,
                arbiter: entry.arbiter,
            })
        } else {
            Some(PrivacyAwareEscrowView {
                token: entry.token,
                amount_due: None,
                amount_paid: None,
                owner: None,
                status: entry.status,
                created_at: entry.created_at,
                expires_at: entry.expires_at,
                arbiter: None,
            })
        }
    }

    // ── Health ───────────────────────────────────────────────────────

    pub fn health_check() -> bool {
        true
    }
}
