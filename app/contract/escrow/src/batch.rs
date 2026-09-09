use soroban_sdk::{contracttype, Address, Env, Vec};

use stellar_dao_shared::errors::StellarBasicDAOError;
use stellar_dao_shared::storage::{get_escrow, put_escrow};
use stellar_dao_shared::types::{EscrowEntry, EscrowStatus};

/// Maximum number of items allowed in a single batch call.
#[allow(dead_code)] // Unwired sub-contract API; kept for future entry-point wiring.
const MAX_BATCH_SIZE: u32 = 20;

/// Per-item outcome returned by every batch function.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BatchItemResult {
    pub index: u32,
    pub success: bool,
    /// Non-zero on failure; maps to ` StellarBasicDAOError` discriminant.
    pub error_code: u32,
}

// ────────────────────────────────────────────────────────────────────────────
// Batch create
// ────────────────────────────────────────────────────────────────────────────

/// Parameters for a single escrow to be created inside a batch.
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchCreateItem {
    pub escrow_id: soroban_sdk::Bytes,
    pub owner: Address,
    pub token: Address,
    pub amount: i128,
    /// Unix timestamp; 0 means no expiry.
    pub expires_at: u64,
}

/// Create up to `MAX_BATCH_SIZE` escrows in one call.
///
/// Returns one `BatchItemResult` per input item.  The caller (owner) must
/// authorise the call once; individual escrow amounts are validated per item.
#[allow(dead_code)] // Unwired sub-contract API; kept for future entry-point wiring.
pub fn batch_create(
    env: &Env,
    caller: &Address,
    items: Vec<BatchCreateItem>,
) -> Result<Vec<BatchItemResult>, StellarBasicDAOError> {
    caller.require_auth();

    if items.len() > MAX_BATCH_SIZE {
        return Err(StellarBasicDAOError::InvalidAmount);
    }

    let mut results: Vec<BatchItemResult> = Vec::new(env);

    for (i, item) in items.iter().enumerate() {
        let idx = i as u32;

        if item.amount <= 0 {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::InvalidAmount as u32,
            });
            continue;
        }

        // INV-OWN: match the single-op `deposit` authorization — the escrow
        // owner must be the caller, not an arbitrary address.
        if item.owner != *caller {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::InvalidOwner as u32,
            });
            continue;
        }

        if get_escrow(env, &item.escrow_id).is_some() {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::CommitmentAlreadyExists as u32,
            });
            continue;
        }

        // INV-FUND: batch_create does not move tokens, so the escrow starts
        // unpaid (amount_paid = 0) — do not fabricate a fully-paid record.
        let entry = EscrowEntry {
            owner: item.owner.clone(),
            token: item.token.clone(),
            amount_due: item.amount,
            amount_paid: 0,
            status: EscrowStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: item.expires_at,
            arbiter: None,
            arbiters: soroban_sdk::Vec::new(env),
            arbiter_threshold: 0,
            schema_version: 1,
        };

        put_escrow(env, &item.escrow_id, &entry);
        results.push_back(BatchItemResult {
            index: idx,
            success: true,
            error_code: 0,
        });
    }

    Ok(results)
}

// ────────────────────────────────────────────────────────────────────────────
// Batch release (withdraw)
// ────────────────────────────────────────────────────────────────────────────

/// Release funds for multiple escrows.  Each escrow must be in `Pending` state
/// and must not have expired.
#[allow(dead_code)] // Unwired sub-contract API; kept for future entry-point wiring.
pub fn batch_release(
    env: &Env,
    caller: &Address,
    escrow_ids: Vec<soroban_sdk::Bytes>,
) -> Result<Vec<BatchItemResult>, StellarBasicDAOError> {
    caller.require_auth();

    if escrow_ids.len() > MAX_BATCH_SIZE {
        return Err(StellarBasicDAOError::InvalidAmount);
    }

    let now = env.ledger().timestamp();
    let mut results: Vec<BatchItemResult> = Vec::new(env);

    for (i, id) in escrow_ids.iter().enumerate() {
        let idx = i as u32;

        let mut entry = match get_escrow(env, &id) {
            Some(e) => e,
            None => {
                results.push_back(BatchItemResult {
                    index: idx,
                    success: false,
                    error_code: StellarBasicDAOError::CommitmentNotFound as u32,
                });
                continue;
            }
        };

        // INV-OWN: only the escrow owner may release their own escrow,
        // matching the single-op `withdraw`/`refund` authorization.
        if entry.owner != *caller {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::InvalidOwner as u32,
            });
            continue;
        }

        if entry.status != EscrowStatus::Pending {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::AlreadySpent as u32,
            });
            continue;
        }

        if entry.expires_at > 0 && now >= entry.expires_at {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::EscrowExpired as u32,
            });
            continue;
        }

        entry.status = EscrowStatus::Spent;
        put_escrow(env, &id, &entry);
        results.push_back(BatchItemResult {
            index: idx,
            success: true,
            error_code: 0,
        });
    }

    Ok(results)
}

// ────────────────────────────────────────────────────────────────────────────
// Batch refund
// ────────────────────────────────────────────────────────────────────────────

/// Refund expired escrows back to their owners.  Each escrow must have expired
/// and still be in `Pending` state.
#[allow(dead_code)] // Unwired sub-contract API; kept for future entry-point wiring.
pub fn batch_refund(
    env: &Env,
    caller: &Address,
    escrow_ids: Vec<soroban_sdk::Bytes>,
) -> Result<Vec<BatchItemResult>, StellarBasicDAOError> {
    caller.require_auth();

    if escrow_ids.len() > MAX_BATCH_SIZE {
        return Err(StellarBasicDAOError::InvalidAmount);
    }

    let now = env.ledger().timestamp();
    let mut results: Vec<BatchItemResult> = Vec::new(env);

    for (i, id) in escrow_ids.iter().enumerate() {
        let idx = i as u32;

        let mut entry = match get_escrow(env, &id) {
            Some(e) => e,
            None => {
                results.push_back(BatchItemResult {
                    index: idx,
                    success: false,
                    error_code: StellarBasicDAOError::CommitmentNotFound as u32,
                });
                continue;
            }
        };

        // INV-OWN: only the escrow owner may refund their own escrow,
        // matching the single-op `refund` authorization.
        if entry.owner != *caller {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::InvalidOwner as u32,
            });
            continue;
        }

        if entry.status != EscrowStatus::Pending {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::AlreadySpent as u32,
            });
            continue;
        }

        if entry.expires_at == 0 || now < entry.expires_at {
            results.push_back(BatchItemResult {
                index: idx,
                success: false,
                error_code: StellarBasicDAOError::EscrowNotExpired as u32,
            });
            continue;
        }

        entry.status = EscrowStatus::Refunded;
        put_escrow(env, &id, &entry);
        results.push_back(BatchItemResult {
            index: idx,
            success: true,
            error_code: 0,
        });
    }

    Ok(results)
}
