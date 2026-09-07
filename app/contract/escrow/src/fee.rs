//! Platform fee calculation logic.

use crate::oracle;
use soroban_sdk::{Address, Env};
use stellar_dao_shared::{errors::StellarBasicDAOError, storage, types::FeeRatio};

/// Calculate the platform fee for a given amount using the global config.
///
/// Uses dynamic oracle pricing when configured and falls back to the static
/// fee basis points if the oracle is unavailable or stale.
pub fn calculate_fee(env: &Env, amount: i128) -> i128 {
    if amount <= 0 {
        return 0;
    }

    if let Some(oracle_config) = storage::get_oracle_fee_config(env) {
        if let Some((price_micros, timestamp)) = oracle::fetch_price(env, &oracle_config.oracle) {
            let now = env.ledger().timestamp();
            if price_micros > 0
                && now.saturating_sub(timestamp) <= oracle_config.stale_threshold_secs
            {
                let fee = oracle_config
                    .usd_fee_micros
                    .saturating_mul(1_000_000)
                    .checked_div(price_micros)
                    .unwrap_or(0);
                if fee > amount {
                    return amount;
                }
                return fee;
            }
        }
    }

    let config = storage::get_fee_config(env);
    if config.fee_bps == 0 {
        return 0;
    }

    let bps = config.fee_bps as i128;
    (amount * bps) / 10000
}

/// Calculate the platform fee for a specific token (Fee Router v2).
///
/// Priority:
/// 1. Per-asset fee config for `token` (if set).
/// 2. Oracle dynamic pricing (if configured and fresh).
/// 3. Global static `FeeConfig` basis points.
pub fn calculate_fee_for_token(env: &Env, token: &Address, amount: i128) -> i128 {
    if amount <= 0 {
        return 0;
    }
    // Per-asset override is highest priority and bypasses oracle.
    if let Some(per_asset) = storage::get_per_asset_fee(env, token) {
        if per_asset.fee_bps == 0 {
            return 0;
        }
        return (amount * per_asset.fee_bps as i128) / 10000;
    }
    // Fall back to oracle + global bps path.
    calculate_fee(env, amount)
}

/// Apply a prescaled ratio to an amount.
pub fn apply_fee_ratio(amount: i128, ratio: &FeeRatio) -> Result<i128, StellarBasicDAOError> {
    if amount <= 0 || ratio.numerator == 0 {
        return Ok(0);
    }

    ratio.validate()?;

    let scaled = amount
        .checked_mul(ratio.numerator as i128)
        .ok_or(StellarBasicDAOError::InvalidFeeConfiguration)?;
    Ok(scaled / ratio.denominator as i128)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl, Address, Env};
    use stellar_dao_shared::storage::DataKey;
    use stellar_dao_shared::types::{FeeConfig, FeeRatio, PerAssetFeeConfig};

    /// Minimal host contract so tests can read/write persistent storage,
    /// which Soroban only allows from within an active contract context.
    #[contract]
    struct FeeTestHost;

    #[contractimpl]
    impl FeeTestHost {}

    /// Run `f` with an Env whose current contract is `FeeTestHost`.
    fn run_test(f: impl FnOnce(&Env)) {
        let env = Env::default();
        let addr = env.register_contract(None, FeeTestHost);
        env.as_contract(&addr, || f(&env));
    }

    fn set_global_fee(env: &Env, fee_bps: u32) {
        let config = FeeConfig {
            fee_bps,
            schema_version: stellar_dao_shared::types::FEE_CONFIG_SCHEMA_VERSION,
        };
        env.storage().persistent().set(&DataKey::FeeConfig, &config);
    }

    #[test]
    fn zero_and_negative_amounts_never_charge_fees() {
        run_test(|env| {
            set_global_fee(env, 100);
            assert_eq!(calculate_fee(env, 0), 0);
            assert_eq!(calculate_fee(env, -1), 0);
            let token = Address::generate(env);
            assert_eq!(calculate_fee_for_token(env, &token, 0), 0);
        });
    }

    #[test]
    fn global_fee_config_applies_basis_points() {
        run_test(|env| {
            set_global_fee(env, 100); // 100 bps = 1%
            assert_eq!(calculate_fee(env, 1_000_000), 10_000);
            assert_eq!(calculate_fee(env, 999), 9); // integer truncation
        });
    }

    #[test]
    fn zero_bps_global_config_charges_nothing() {
        run_test(|env| {
            set_global_fee(env, 0);
            assert_eq!(calculate_fee(env, 5_000_000), 0);
        });
    }

    #[test]
    fn max_fee_bps_cannot_exceed_deposit_amount() {
        run_test(|env| {
            set_global_fee(env, 10_000); // 100%
            assert_eq!(calculate_fee(env, 1_000), 1_000);
        });
    }

    #[test]
    fn per_asset_override_takes_priority_over_global() {
        run_test(|env| {
            set_global_fee(env, 100); // global 1%
            let token = Address::generate(env);

            let per_asset = PerAssetFeeConfig {
                fee_bps: 50, // 0.5% for this token only
                ..Default::default()
            };
            per_asset.validate().unwrap();
            env.storage()
                .persistent()
                .set(&DataKey::PerAssetFee(token.clone()), &per_asset);

            assert_eq!(calculate_fee(env, 1_000_000), 10_000); // global path unchanged
            assert_eq!(calculate_fee_for_token(env, &token, 1_000_000), 5_000);
            // Other tokens are unaffected by the override.
            let other = Address::generate(env);
            assert_eq!(calculate_fee_for_token(env, &other, 1_000_000), 10_000);
        });
    }

    #[test]
    fn per_asset_zero_bps_explicitly_disables_fees() {
        run_test(|env| {
            set_global_fee(env, 100);
            let token = Address::generate(env);
            let per_asset = PerAssetFeeConfig {
                fee_bps: 0,
                ..Default::default()
            };
            env.storage()
                .persistent()
                .set(&DataKey::PerAssetFee(token.clone()), &per_asset);
            assert_eq!(calculate_fee_for_token(env, &token, 1_000_000), 0);
        });
    }

    #[test]
    fn apply_fee_ratio_scales_amount() {
        let ratio = FeeRatio {
            numerator: 1,
            denominator: 4,
        };
        assert_eq!(apply_fee_ratio(1_000, &ratio).unwrap(), 250);
    }

    #[test]
    fn apply_fee_ratio_disabled_when_numerator_zero() {
        let ratio = FeeRatio {
            numerator: 0,
            denominator: 4,
        };
        assert_eq!(apply_fee_ratio(1_000, &ratio).unwrap(), 0);
    }

    #[test]
    fn apply_fee_ratio_rejects_invalid_ratios() {
        let invalid = FeeRatio {
            numerator: 1,
            denominator: 0,
        };
        assert_eq!(
            apply_fee_ratio(1_000, &invalid).unwrap_err(),
            StellarBasicDAOError::InvalidFeeConfiguration
        );
        let inverted = FeeRatio {
            numerator: 3,
            denominator: 2,
        };
        assert_eq!(
            apply_fee_ratio(1_000, &inverted).unwrap_err(),
            StellarBasicDAOError::InvalidFeeConfiguration
        );
    }

    #[test]
    fn fee_is_bounded_below_amount_for_any_rate() {
        run_test(|env| {
            // Largest realistic Stellar token amount (~i64::MAX) and full 100% rate.
            let max_amount = i64::MAX as i128;
            for bps in [1u32, 5_000, 10_000] {
                set_global_fee(env, bps);
                let fee = calculate_fee(env, max_amount);
                assert!(fee >= 0, "fee must never be negative");
                assert!(fee <= max_amount, "fee must never exceed the amount");
            }
        });
    }
}
