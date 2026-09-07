use soroban_sdk::{Address, Env};
use stellar_dao_shared::{storage, types::OracleFeeConfig};

/// Symbol for the oracle's price query function.
const ORACLE_FN_LASTPRICE: &str = "lastprice";

/// Get the configured oracle fee configuration, if any.
pub fn get_oracle_fee_config(env: &Env) -> Option<OracleFeeConfig> {
    storage::get_oracle_fee_config(env)
}

/// Fetch the current price and timestamp from an external oracle contract.
///
/// Calls `oracle.lastprice(asset)` to retrieve the current USD price of
/// the base asset. The oracle is expected to return `(u128, u64)` where
/// the first value is the price in micro-units (1 USD = 1_000_000) and
/// the second is the ledger timestamp of the price update.
///
/// # Fallback behavior
///
/// Returns `None` when:
/// - No oracle is configured (oracle address is missing from storage)
/// - The oracle contract is not deployed at the given address
/// - The oracle contract's interface does not match expectations
/// - The oracle call fails or panics
///
/// # Price format
///
/// The returned price is in **micro-units** (e.g., an XLM price of $0.10
/// USD is returned as 100_000, meaning 100_000 microdollars per XLM).
/// The fee module uses this to compute dynamic fees by converting the
/// configured `usd_fee_micros` into token units.
///
/// # Staleness
///
/// Callers MUST check the returned timestamp against
/// `OracleFeeConfig::stale_threshold_secs` before using the price.
/// This module returns the raw values; the fee module performs the
/// staleness check.
pub fn fetch_price(env: &Env, oracle: &Address) -> Option<(i128, u64)> {
    // Cross-contract oracle call for dynamic fee pricing.
    // Calls oracle.lastprice() and expects (i128, u64) return: (price_micros, timestamp).
    // Uses try_invoke_contract for safe fallback on any call failure.
    use soroban_sdk::{Symbol, Val, Vec};
    let args: Vec<Val> = Vec::new(env);
    let result = env.try_invoke_contract::<(i128, u64), soroban_sdk::Error>(
        oracle,
        &Symbol::new(env, ORACLE_FN_LASTPRICE),
        args,
    );
    match result {
        Ok(Ok((price, timestamp))) if price > 0 => Some((price, timestamp)),
        _ => None,
    }
}

/// Fetch the XLM/USD price from the configured oracle.
///
/// Convenience wrapper around `fetch_price` that uses the configured
/// oracle address from storage.
pub fn fetch_xlm_price(env: &Env) -> Option<(i128, u64)> {
    let config = storage::get_oracle_fee_config(env)?;
    fetch_price(env, &config.oracle)
}

/// Check if a price feed is fresh enough to use.
///
/// Returns `true` if the price timestamp is within the configured
/// staleness threshold. Returns `false` (stale or unavailable) otherwise.
pub fn is_price_fresh(env: &Env, timestamp: u64) -> bool {
    let config = match storage::get_oracle_fee_config(env) {
        Some(c) => c,
        None => return false,
    };
    let now = env.ledger().timestamp();
    now.saturating_sub(timestamp) <= config.stale_threshold_secs
}
