#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

mod fee;
mod fee_router;
mod oracle;

use stellar_dao_shared::errors::StellarBasicDAOError;
use stellar_dao_shared::types::{FeeConfig, OracleFeeConfig, PerAssetFeeConfig};

/// Stellar Basic DAO — Fee Router Sub-contract
#[contract]
pub struct FeeContract;

#[contractimpl]
impl FeeContract {
    pub fn set_fee_config(
        env: Env,
        caller: Address,
        config: FeeConfig,
    ) -> Result<(), StellarBasicDAOError> {
        caller.require_auth();
        let _admin = stellar_dao_shared::storage::get_admin(&env)
            .ok_or(StellarBasicDAOError::Unauthorized)?;
        stellar_dao_shared::storage::set_fee_config(&env, &config);
        Ok(())
    }

    pub fn get_fee_config(env: Env) -> FeeConfig {
        stellar_dao_shared::storage::get_fee_config(&env)
    }

    pub fn set_per_asset_fee(
        env: Env,
        caller: Address,
        token: Address,
        config: PerAssetFeeConfig,
    ) -> Result<(), StellarBasicDAOError> {
        caller.require_auth();
        let _admin = stellar_dao_shared::storage::get_admin(&env)
            .ok_or(StellarBasicDAOError::Unauthorized)?;
        stellar_dao_shared::storage::set_per_asset_fee(&env, &token, &config);
        Ok(())
    }

    pub fn get_per_asset_fee(env: Env, token: Address) -> Option<PerAssetFeeConfig> {
        stellar_dao_shared::storage::get_per_asset_fee(&env, &token)
    }

    pub fn set_oracle_fee_config(
        env: Env,
        caller: Address,
        config: OracleFeeConfig,
    ) -> Result<(), StellarBasicDAOError> {
        caller.require_auth();
        let _admin = stellar_dao_shared::storage::get_admin(&env)
            .ok_or(StellarBasicDAOError::Unauthorized)?;
        stellar_dao_shared::storage::set_oracle_fee_config(&env, &config);
        Ok(())
    }

    pub fn get_oracle_fee_config(env: Env) -> Option<OracleFeeConfig> {
        oracle::get_oracle_fee_config(&env)
    }

    pub fn get_platform_wallet(env: Env) -> Option<Address> {
        stellar_dao_shared::storage::get_platform_wallet(&env)
    }

    pub fn set_platform_wallet(
        env: Env,
        caller: Address,
        wallet: Address,
    ) -> Result<(), StellarBasicDAOError> {
        caller.require_auth();
        let _admin = stellar_dao_shared::storage::get_admin(&env)
            .ok_or(StellarBasicDAOError::Unauthorized)?;
        stellar_dao_shared::storage::set_platform_wallet(&env, &wallet);
        Ok(())
    }

    pub fn rotate_fee_collector(
        env: Env,
        caller: Address,
        new_collector: Address,
    ) -> Result<u32, StellarBasicDAOError> {
        caller.require_auth();
        let _admin = stellar_dao_shared::storage::get_admin(&env)
            .ok_or(StellarBasicDAOError::Unauthorized)?;
        Ok(fee_router::rotate_collector(&env, &new_collector))
    }

    pub fn get_active_fee_collector(env: Env) -> Option<Address> {
        fee_router::active_collector(&env)
    }

    pub fn health_check() -> bool {
        true
    }
}
