#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env};

mod stealth;

use stellar_dao_shared::errors::StellarBasicDAOError;
use stellar_dao_shared::types::{EscrowStatus, StealthDepositParams};

/// Stellar Basic DAO — Stealth Address Sub-contract
///
/// Handles privacy-preserving stealth address deposits and withdrawals.
/// Funds are locked under one-time addresses; recipient identity is only
/// revealed at withdrawal time.
#[contract]
pub struct StealthContract;

#[contractimpl]
impl StealthContract {
    pub fn register_ephemeral_key(
        env: Env,
        params: StealthDepositParams,
    ) -> Result<BytesN<32>, StellarBasicDAOError> {
        stealth::register_ephemeral_key(&env, params)
    }

    pub fn stealth_withdraw(
        env: Env,
        recipient: Address,
        eph_pub: BytesN<32>,
        spend_pub: BytesN<32>,
        stealth_address: BytesN<32>,
    ) -> Result<bool, StellarBasicDAOError> {
        stealth::stealth_withdraw(&env, recipient, eph_pub, spend_pub, stealth_address)
    }

    pub fn get_stealth_status(env: Env, stealth_address: BytesN<32>) -> Option<EscrowStatus> {
        stealth::get_stealth_status(&env, &stealth_address)
    }

    pub fn cleanup_stealth_escrow(
        env: Env,
        stealth_address: BytesN<32>,
    ) -> Result<(), StellarBasicDAOError> {
        stealth::cleanup_stealth_escrow(&env, stealth_address)
    }

    pub fn health_check() -> bool {
        true
    }
}
