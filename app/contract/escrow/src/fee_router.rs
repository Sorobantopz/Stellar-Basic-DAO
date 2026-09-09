use crate::fee;
use soroban_sdk::{token, Address, Env};
use stellar_dao_shared::{errors::StellarBasicDAOError, storage};

/// Fee breakdown returned by [`route_payout`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct FeeBreakdown {
    pub net_payout: i128,
    pub total_fee: i128,
    pub arbiter_fee: i128,
    pub platform_fee: i128,
    pub collector_fee: i128,
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/// Resolve the effective fee collector address.
///
/// Reads the current rotation index, then the `FeeCollector` at that index.
/// Falls back to the `PlatformWallet` singleton if no rotated collector has
/// ever been stored.
pub fn active_collector(env: &Env) -> Option<Address> {
    let idx = storage::get_fee_collector_index(env);
    if let Some(addr) = storage::get_fee_collector_at(env, idx) {
        return Some(addr);
    }
    storage::get_platform_wallet(env)
}

fn uses_explicit_fee_distribution(config: &stellar_dao_shared::types::PerAssetFeeConfig) -> bool {
    config.arbiter_fee.is_active()
        || config.platform_fee.is_active()
        || config.collector_fee.is_active()
}

fn transfer_if_positive(
    env: &Env,
    token_client: &token::Client,
    recipient: &Address,
    amount: i128,
) {
    if amount > 0 {
        token_client.transfer(&env.current_contract_address(), recipient, &amount);
    }
}

// ---------------------------------------------------------------------------
// Collector rotation
// ---------------------------------------------------------------------------

/// Rotate to a new fee collector address.
///
/// Atomically increments the `FeeCollectorIndex` and stores `new_collector`
/// at the new index. All subsequent calls to [`active_collector`] will return
/// `new_collector` until the next rotation.
///
/// **Caller is responsible for authorization** — call only from admin entry points.
#[allow(dead_code)] // Unwired sub-contract API; kept for future entry-point wiring.
pub fn rotate_collector(env: &Env, new_collector: &Address) -> u32 {
    let current = storage::get_fee_collector_index(env);
    let next = current.saturating_add(1);
    storage::set_fee_collector_index(env, next);
    storage::set_fee_collector_at(env, next, new_collector);
    next
}

// ---------------------------------------------------------------------------
// Core routing
// ---------------------------------------------------------------------------

/// Route a settled payout, applying per-asset fees, arbiter splits, and
/// collector rotation in a single atomic operation.
///
/// Performs all token transfers from `env.current_contract_address()`:
/// - Net payout → `recipient`
/// - Arbiter portion of fee → `arbiter` (if `arbiter_bps > 0` and `arbiter` provided)
/// - Platform portion of fee → active collector (if set)
///
/// Returns `(net_payout, total_fee)`.
///
/// # Arguments
/// * `token`     — Token contract address (XLM or SAC)
/// * `recipient` — Beneficiary of the net payout
/// * `amount`    — Gross amount to distribute (must be > 0)
/// * `arbiter`   — Optional arbiter address for fee split
///
/// # Safety
/// If `amount <= 0`, returns `(amount, 0)` without any transfers.
pub fn route_payout(
    env: &Env,
    token: &Address,
    recipient: &Address,
    amount: i128,
    arbiter: Option<&Address>,
) -> Result<FeeBreakdown, StellarBasicDAOError> {
    if amount <= 0 {
        return Ok(FeeBreakdown {
            net_payout: amount,
            total_fee: 0,
            arbiter_fee: 0,
            platform_fee: 0,
            collector_fee: 0,
        });
    }

    // Resolve total fee using per-asset → oracle → global priority.
    let total_fee = fee::calculate_fee_for_token(env, token, amount);
    let net_payout = amount.saturating_sub(total_fee);
    let token_client = token::Client::new(env, token);
    let per_asset = storage::get_per_asset_fee(env, token);

    let mut arbiter_fee = 0;
    let mut platform_fee = 0;
    let mut collector_fee = total_fee;

    if let Some(config) = per_asset {
        if uses_explicit_fee_distribution(&config) {
            let arbiter_share = fee::apply_fee_ratio(total_fee, &config.arbiter_fee)?;
            arbiter_fee = if arbiter.is_some() { arbiter_share } else { 0 };
            platform_fee = fee::apply_fee_ratio(total_fee, &config.platform_fee)?;
            collector_fee = fee::apply_fee_ratio(total_fee, &config.collector_fee)?;

            if arbiter.is_none() {
                collector_fee = collector_fee.saturating_add(arbiter_share);
            }

            let distributed = arbiter_fee
                .checked_add(platform_fee)
                .and_then(|value| value.checked_add(collector_fee))
                .ok_or(StellarBasicDAOError::InvalidFeeConfiguration)?;

            if distributed > total_fee {
                return Err(StellarBasicDAOError::InvalidFeeConfiguration);
            }

            collector_fee = collector_fee.saturating_add(total_fee - distributed);
        } else {
            let arbiter_bps = config.arbiter_bps;
            if arbiter_bps > 0 && arbiter.is_some() {
                arbiter_fee = (total_fee * arbiter_bps as i128) / 10000;
                collector_fee = total_fee.saturating_sub(arbiter_fee);
            }
        }
    }

    let platform_recipient = storage::get_platform_wallet(env);
    let active_collector = active_collector(env);

    if let Some(arb) = arbiter {
        transfer_if_positive(env, &token_client, arb, arbiter_fee);
    } else if arbiter_fee > 0 {
        collector_fee = collector_fee.saturating_add(arbiter_fee);
        arbiter_fee = 0;
    }

    if let Some(platform) = platform_recipient {
        transfer_if_positive(env, &token_client, &platform, platform_fee);
    } else if platform_fee > 0 {
        collector_fee = collector_fee.saturating_add(platform_fee);
        platform_fee = 0;
    }

    if let Some(collector) = active_collector {
        transfer_if_positive(env, &token_client, &collector, collector_fee);
    } else if collector_fee > 0 {
        // No collector is configured; keep the fees in the contract rather than failing
        // the payout path. This preserves backward-compatible no-op behavior.
    }

    token_client.transfer(&env.current_contract_address(), recipient, &net_payout);

    Ok(FeeBreakdown {
        net_payout,
        total_fee,
        arbiter_fee,
        platform_fee,
        collector_fee,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl, token::StellarAssetClient, Address, Env};
    use stellar_dao_shared::types::{
        FeeConfig, FeeRatio, PerAssetFeeConfig, FEE_CONFIG_SCHEMA_VERSION,
    };

    /// Minimal host contract so tests can write persistent storage and act as
    /// the token `from` during transfers, which Soroban only allows from
    /// within an active contract context.
    #[contract]
    struct RouterTestHost;

    #[contractimpl]
    impl RouterTestHost {}

    /// A fully configured payout environment:
    /// a registered token, four distinct parties, and storage wiring helpers.
    struct PayoutHarness {
        env: Env,
        token: Address,
        recipient: Address,
        arbiter: Address,
        platform: Address,
        collector: Address,
        host: Address,
    }

    impl PayoutHarness {
        fn new(global_fee_bps: u32, per_asset: Option<&PerAssetFeeConfig>) -> Self {
            let env = Env::default();
            env.mock_all_auths();
            let host = env.register(RouterTestHost, ());
            let token = env
                .register_stellar_asset_contract_v2(host.clone())
                .address();
            let recipient = Address::generate(&env);
            let arbiter = Address::generate(&env);
            let platform = Address::generate(&env);
            let collector = Address::generate(&env);

            // Storage writes must happen inside an active contract context.
            env.as_contract(&host, || {
                storage::set_fee_config(
                    &env,
                    &FeeConfig {
                        fee_bps: global_fee_bps,
                        schema_version: FEE_CONFIG_SCHEMA_VERSION,
                    },
                );
                if let Some(config) = per_asset {
                    storage::set_per_asset_fee(&env, &token, config);
                }
            });

            PayoutHarness {
                env,
                token,
                recipient,
                arbiter,
                platform,
                collector,
                host,
            }
        }

        fn set_platform_wallet(&self) {
            self.env.as_contract(&self.host, || {
                storage::set_platform_wallet(&self.env, &self.platform);
            });
        }

        fn set_active_collector(&self) {
            self.env.as_contract(&self.host, || {
                let idx = storage::get_fee_collector_index(&self.env);
                storage::set_fee_collector_at(&self.env, idx, &self.collector);
            });
        }

        fn fund_contract(&self, amount: i128) {
            let client = StellarAssetClient::new(&self.env, &self.token);
            client.mint(&self.host, &amount);
        }

        fn balance(&self, who: &Address) -> i128 {
            StellarAssetClient::new(&self.env, &self.token).balance(who)
        }

        /// Run a payout of `amount` to `recipient` with the given arbiter and
        /// return the breakdown.
        fn payout(&self, amount: i128, arbiter: Option<&Address>) -> FeeBreakdown {
            self.env.as_contract(&self.host, || {
                route_payout(&self.env, &self.token, &self.recipient, amount, arbiter).unwrap()
            })
        }
    }

    fn per_asset_with_explicit_split() -> PerAssetFeeConfig {
        PerAssetFeeConfig {
            fee_bps: 200, // 2% of the payout amount
            arbiter_fee: FeeRatio {
                numerator: 1,
                denominator: 4,
            },
            platform_fee: FeeRatio {
                numerator: 1,
                denominator: 4,
            },
            collector_fee: FeeRatio {
                numerator: 1,
                denominator: 4,
            },
            ..Default::default()
        }
    }

    #[test]
    fn zero_or_negative_amount_is_a_no_op_without_transfers() {
        let env = Env::default();
        let host = env.register(RouterTestHost, ());
        env.as_contract(&host, || {
            let token = Address::generate(&env);
            let recipient = Address::generate(&env);

            let breakdown = route_payout(&env, &token, &recipient, 0, None).unwrap();
            assert_eq!(
                breakdown,
                FeeBreakdown {
                    net_payout: 0,
                    total_fee: 0,
                    arbiter_fee: 0,
                    platform_fee: 0,
                    collector_fee: 0,
                }
            );

            let breakdown = route_payout(&env, &token, &recipient, -5, None).unwrap();
            assert_eq!(breakdown.net_payout, -5);
            assert_eq!(breakdown.total_fee, 0);
        });
    }

    #[test]
    fn rotated_collector_wins_over_platform_wallet_fallback() {
        let h = PayoutHarness::new(100, None); // 1% global fee
        h.set_platform_wallet();
        h.set_active_collector();
        h.fund_contract(1_000_000);

        let breakdown = h.payout(1_000_000, Some(&h.arbiter));

        // The rotated collector (not the platform wallet) receives the fee.
        assert_eq!(breakdown.total_fee, 10_000);
        assert_eq!(breakdown.net_payout, 990_000);
        assert_eq!(breakdown.collector_fee, 10_000);
        assert_eq!(breakdown.platform_fee, 0);
        assert_eq!(breakdown.arbiter_fee, 0);
        assert_eq!(h.balance(&h.collector), 10_000);
        assert_eq!(h.balance(&h.platform), 0);
        assert_eq!(h.balance(&h.recipient), 990_000);
        assert_eq!(h.balance(&h.host), 0);
    }

    #[test]
    fn explicit_split_sends_each_share_and_sweeps_rounding_dust_to_collector() {
        let per_asset = per_asset_with_explicit_split();
        let h = PayoutHarness::new(100, Some(&per_asset));
        h.set_platform_wallet();
        h.set_active_collector();
        h.fund_contract(1_000_000);

        let breakdown = h.payout(1_000_000, Some(&h.arbiter));

        // fee = 2% of 1_000_000 = 20_000. Three 1/4 ratios only distribute
        // 15_000; the 5_000 rounding remainder must be swept to the collector
        // so total_fee is never stranded or minted out of thin air.
        assert_eq!(breakdown.total_fee, 20_000);
        assert_eq!(breakdown.net_payout, 980_000);
        assert_eq!(breakdown.arbiter_fee, 5_000);
        assert_eq!(breakdown.platform_fee, 5_000);
        assert_eq!(breakdown.collector_fee, 10_000);
        assert_eq!(h.balance(&h.arbiter), 5_000);
        assert_eq!(h.balance(&h.platform), 5_000);
        assert_eq!(h.balance(&h.collector), 10_000);
        assert_eq!(h.balance(&h.recipient), 980_000);
        assert_eq!(h.balance(&h.host), 0);
    }

    #[test]
    fn absent_arbiter_rolls_its_share_into_the_collector() {
        let per_asset = per_asset_with_explicit_split();
        let h = PayoutHarness::new(100, Some(&per_asset));
        h.set_platform_wallet();
        h.set_active_collector();
        h.fund_contract(1_000_000);

        let breakdown = h.payout(1_000_000, None);

        // Collector absorbs the arbiter's 5_000 share plus the 5_000 dust on
        // top of its own 5_000 share, and nothing is paid to an absent party.
        assert_eq!(breakdown.total_fee, 20_000);
        assert_eq!(breakdown.net_payout, 980_000);
        assert_eq!(breakdown.arbiter_fee, 0);
        assert_eq!(breakdown.platform_fee, 5_000);
        assert_eq!(breakdown.collector_fee, 15_000);
        assert_eq!(h.balance(&h.platform), 5_000);
        assert_eq!(h.balance(&h.collector), 15_000);
        assert_eq!(h.balance(&h.recipient), 980_000);
        assert_eq!(h.balance(&h.host), 0);
    }

    #[test]
    fn legacy_arbiter_bps_splits_fee_between_arbiter_and_collector() {
        let per_asset = PerAssetFeeConfig {
            fee_bps: 200,
            arbiter_bps: 2000, // 20% of the fee
            ..Default::default()
        };
        let h = PayoutHarness::new(100, Some(&per_asset));
        h.set_platform_wallet();
        h.set_active_collector();
        h.fund_contract(1_000_000);

        let breakdown = h.payout(1_000_000, Some(&h.arbiter));

        // fee = 20_000; arbiter gets 20% = 4_000, collector keeps 16_000.
        assert_eq!(breakdown.total_fee, 20_000);
        assert_eq!(breakdown.net_payout, 980_000);
        assert_eq!(breakdown.arbiter_fee, 4_000);
        assert_eq!(breakdown.collector_fee, 16_000);
        assert_eq!(breakdown.platform_fee, 0);
        assert_eq!(h.balance(&h.arbiter), 4_000);
        assert_eq!(h.balance(&h.platform), 0);
        assert_eq!(h.balance(&h.collector), 16_000);
        assert_eq!(h.balance(&h.recipient), 980_000);
        assert_eq!(h.balance(&h.host), 0);
    }

    #[test]
    fn per_asset_zero_bps_disables_fees_entirely() {
        let per_asset = PerAssetFeeConfig {
            fee_bps: 0,
            ..Default::default()
        };
        // Global config alone would charge 100% — the per-asset zero must win.
        let h = PayoutHarness::new(10_000, Some(&per_asset));
        h.set_platform_wallet();
        h.set_active_collector();
        h.fund_contract(1_000_000);

        let breakdown = h.payout(1_000_000, Some(&h.arbiter));

        assert_eq!(breakdown.total_fee, 0);
        assert_eq!(breakdown.net_payout, 1_000_000);
        assert_eq!(breakdown.collector_fee, 0);
        assert_eq!(h.balance(&h.recipient), 1_000_000);
        assert_eq!(h.balance(&h.collector), 0);
        assert_eq!(h.balance(&h.host), 0);
    }
}
