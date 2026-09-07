//! Unit tests for the amount-commitment scheme.

#[cfg(test)]
mod tests {
    use crate::commitment::{
        amount_commitment_hashes, create_amount_commitment, verify_amount_commitment,
    };
    use crate::errors::StellarBasicDAOError;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Bytes, Env};

    fn sample_salt(env: &Env) -> Bytes {
        // 32 bytes of deterministic salt data.
        let mut salt = Bytes::new(env);
        for i in 0..32u8 {
            salt.push_back(i);
        }
        salt
    }

    #[test]
    fn commitment_is_deterministic() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let a = create_amount_commitment(&env, owner.clone(), 1_000, sample_salt(&env)).unwrap();
        let b = create_amount_commitment(&env, owner, 1_000, sample_salt(&env)).unwrap();
        assert_eq!(a, b, "identical inputs must produce identical commitments");
    }

    #[test]
    fn changing_amount_changes_commitment() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let a = create_amount_commitment(&env, owner.clone(), 1_000, sample_salt(&env)).unwrap();
        let b = create_amount_commitment(&env, owner, 999, sample_salt(&env)).unwrap();
        assert_ne!(a, b, "different amounts must produce different commitments");
    }

    #[test]
    fn changing_salt_changes_commitment() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let mut other_salt = Bytes::new(&env);
        other_salt.push_back(0xFF);
        let a = create_amount_commitment(&env, owner.clone(), 1_000, sample_salt(&env)).unwrap();
        let b = create_amount_commitment(&env, owner, 1_000, other_salt).unwrap();
        assert_ne!(a, b, "different salts must produce different commitments");
    }

    #[test]
    fn negative_amount_is_rejected() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let err = create_amount_commitment(&env, owner, -1, sample_salt(&env)).unwrap_err();
        assert_eq!(err, StellarBasicDAOError::InvalidAmount);
    }

    #[test]
    fn oversized_salt_is_rejected() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let big_salt = Bytes::from_array(&env, &[0u8; 1025]);
        let err = create_amount_commitment(&env, owner, 100, big_salt).unwrap_err();
        assert_eq!(err, StellarBasicDAOError::InvalidSalt);
    }

    #[test]
    fn verify_accepts_matching_preimage() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let salt = sample_salt(&env);
        let commitment = create_amount_commitment(&env, owner.clone(), 42, salt.clone()).unwrap();
        assert!(verify_amount_commitment(&env, commitment, owner, 42, salt));
    }

    #[test]
    fn verify_rejects_wrong_amount() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let salt = sample_salt(&env);
        let commitment = create_amount_commitment(&env, owner.clone(), 42, salt.clone()).unwrap();
        assert!(!verify_amount_commitment(&env, commitment, owner, 43, salt));
    }

    #[test]
    fn verify_rejects_wrong_salt() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let salt = sample_salt(&env);
        let mut wrong_salt = Bytes::new(&env);
        wrong_salt.push_back(7);
        let commitment = create_amount_commitment(&env, owner.clone(), 42, salt).unwrap();
        assert!(!verify_amount_commitment(&env, commitment, owner, 42, wrong_salt));
    }

    #[test]
    fn legacy_sha256_commitment_still_verifies() {
        // Backwards compatibility: withdraw paths look up escrows by either the
        // keccak256 commitment or the legacy sha256 one.
        let env = Env::default();
        let owner = Address::generate(&env);
        let salt = sample_salt(&env);
        let (keccak, sha256) = amount_commitment_hashes(&env, &owner, 777, &salt).unwrap();
        assert_ne!(keccak, sha256, "digests must use different algorithms");
        assert!(verify_amount_commitment(
            &env,
            sha256,
            owner.clone(),
            777,
            salt.clone()
        ));
        assert!(verify_amount_commitment(&env, keccak, owner, 777, salt));
    }
}
