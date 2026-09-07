//! Unit tests for pure shared-types logic (no Soroban env required).

#[cfg(test)]
mod tests {
    use crate::types::FeeRatio;

    #[test]
    fn ratio_is_inactive_when_numerator_zero() {
        let ratio = FeeRatio {
            numerator: 0,
            denominator: 100,
        };
        assert!(!ratio.is_active());
    }

    #[test]
    fn ratio_is_active_when_numerator_positive() {
        let ratio = FeeRatio {
            numerator: 1,
            denominator: 100,
        };
        assert!(ratio.is_active());
    }

    #[test]
    fn disabled_ratio_always_validates() {
        // numerator == 0 short-circuits before denominator checks, so an
        // all-zero default ratio is always a valid "no share" configuration.
        let ratio = FeeRatio::default();
        assert!(ratio.validate().is_ok());
    }

    #[test]
    fn valid_ratio_accepts_one_and_unit_denominator() {
        let ratio = FeeRatio {
            numerator: 1,
            denominator: 1,
        };
        assert!(ratio.validate().is_ok());
    }

    #[test]
    fn valid_ratio_accepts_fractional_share() {
        let ratio = FeeRatio {
            numerator: 25,
            denominator: 100,
        };
        assert!(ratio.validate().is_ok());
    }

    #[test]
    fn zero_denominator_is_rejected() {
        let ratio = FeeRatio {
            numerator: 1,
            denominator: 0,
        };
        assert_eq!(
            ratio.validate().unwrap_err(),
            crate::errors::StellarBasicDAOError::InvalidFeeConfiguration
        );
    }

    #[test]
    fn numerator_above_denominator_is_rejected() {
        let ratio = FeeRatio {
            numerator: 101,
            denominator: 100,
        };
        assert_eq!(
            ratio.validate().unwrap_err(),
            crate::errors::StellarBasicDAOError::InvalidFeeConfiguration
        );
    }

    #[test]
    fn default_ratio_has_zero_numerator_and_denominator() {
        let ratio = FeeRatio::default();
        assert_eq!(ratio.numerator, 0);
        assert_eq!(ratio.denominator, 0);
        assert!(!ratio.is_active());
    }
}
