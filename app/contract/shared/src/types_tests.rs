//! Unit tests for pure shared-types logic (no Soroban env required).

use crate::errors::StellarBasicDAOError;
use crate::types::{FeeConfig, FeeRatio, FEE_CONFIG_SCHEMA_VERSION};

#[test]
fn fee_config_accepts_normal_rates() {
    for bps in [0, 1, 100, 500, 10_000] {
        let config = FeeConfig {
            fee_bps: bps,
            schema_version: FEE_CONFIG_SCHEMA_VERSION,
        };
        assert!(config.validate().is_ok(), "fee_bps={bps} should validate");
    }
}

#[test]
fn fee_config_rejects_fees_above_one_hundred_percent() {
    let config = FeeConfig {
        fee_bps: 10_001,
        schema_version: FEE_CONFIG_SCHEMA_VERSION,
    };
    assert_eq!(
        config.validate(),
        Err(StellarBasicDAOError::InvalidFeeConfiguration)
    );

    let config = FeeConfig {
        fee_bps: u32::MAX,
        schema_version: FEE_CONFIG_SCHEMA_VERSION,
    };
    assert_eq!(
        config.validate(),
        Err(StellarBasicDAOError::InvalidFeeConfiguration)
    );
}

// ── FeeRatio tests ───────────────────────────────────────────────────────────

#[test]
fn fee_ratio_is_inactive_when_numerator_zero() {
    let ratio = FeeRatio {
        numerator: 0,
        denominator: 100,
    };
    assert!(!ratio.is_active());
}

#[test]
fn fee_ratio_is_active_when_numerator_positive() {
    let ratio = FeeRatio {
        numerator: 1,
        denominator: 100,
    };
    assert!(ratio.is_active());
}

#[test]
fn fee_ratio_disabled_ratio_always_validates() {
    // numerator == 0 short-circuits before denominator checks, so an
    // all-zero default ratio is always a valid "no share" configuration.
    let ratio = FeeRatio::default();
    assert!(ratio.validate().is_ok());
}

#[test]
fn fee_ratio_valid_ratio_accepts_one_and_unit_denominator() {
    let ratio = FeeRatio {
        numerator: 1,
        denominator: 1,
    };
    assert!(ratio.validate().is_ok());
}

#[test]
fn fee_ratio_valid_ratio_accepts_fractional_share() {
    let ratio = FeeRatio {
        numerator: 25,
        denominator: 100,
    };
    assert!(ratio.validate().is_ok());
}

#[test]
fn fee_ratio_zero_denominator_is_rejected() {
    let ratio = FeeRatio {
        numerator: 1,
        denominator: 0,
    };
    assert_eq!(
        ratio.validate().unwrap_err(),
        StellarBasicDAOError::InvalidFeeConfiguration
    );
}

#[test]
fn fee_ratio_numerator_above_denominator_is_rejected() {
    let ratio = FeeRatio {
        numerator: 101,
        denominator: 100,
    };
    assert_eq!(
        ratio.validate().unwrap_err(),
        StellarBasicDAOError::InvalidFeeConfiguration
    );
}

#[test]
fn fee_ratio_default_ratio_has_zero_numerator_and_denominator() {
    let ratio = FeeRatio::default();
    assert_eq!(ratio.numerator, 0);
    assert_eq!(ratio.denominator, 0);
    assert!(!ratio.is_active());
}
