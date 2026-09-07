//! Unit tests for deterministic escrow-id derivation.

#[cfg(test)]
mod tests {
    use crate::commitment::create_amount_commitment;
    use crate::errors::StellarBasicDAOError;
    use crate::escrow_id::{derive_escrow_id, derive_partial_escrow_id};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Bytes, Env};

    fn salt(env: &Env) -> Bytes {
        let mut s = Bytes::new(env);
        for i in 0..16u8 {
            s.push_back(i);
        }
        s
    }

    #[test]
    fn escrow_id_is_deterministic() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let s = salt(&env);
        let a = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &None).unwrap();
        let b = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &None).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn escrow_id_changes_with_amount_and_owner() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let other = Address::generate(&env);
        let s = salt(&env);
        let base = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &None).unwrap();
        let different_amount = derive_escrow_id(&env, &token, 501, &owner, &s, 60, &None).unwrap();
        let different_owner = derive_escrow_id(&env, &token, 500, &other, &s, 60, &None).unwrap();
        assert_ne!(base, different_amount);
        assert_ne!(base, different_owner);
    }

    #[test]
    fn arbiter_presence_changes_escrow_id() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let arbiter = Address::generate(&env);
        let s = salt(&env);
        let without = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &None).unwrap();
        let with = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &Some(arbiter)).unwrap();
        assert_ne!(without, with);
    }

    #[test]
    fn escrow_id_is_distinct_from_amount_commitment() {
        // Domain separation: the dedup escrow_id must never collide with the
        // privacy commitment used as the storage key.
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let s = salt(&env);
        let id = derive_escrow_id(&env, &token, 500, &owner, &s, 60, &None).unwrap();
        let commitment = create_amount_commitment(&env, owner, 500, s).unwrap();
        assert_ne!(id, commitment);
    }

    #[test]
    fn negative_amount_is_rejected() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let err = derive_escrow_id(&env, &token, -1, &owner, &salt(&env), 60, &None).unwrap_err();
        assert_eq!(err, StellarBasicDAOError::InvalidAmount);
    }

    #[test]
    fn oversized_salt_is_rejected() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let big = Bytes::from_array(&env, &[0u8; 1025]);
        let err = derive_escrow_id(&env, &token, 500, &owner, &big, 60, &None).unwrap_err();
        assert_eq!(err, StellarBasicDAOError::InvalidSalt);
    }

    #[test]
    fn partial_escrow_id_commits_to_initial_payment() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let s = salt(&env);
        let a = derive_partial_escrow_id(&env, &token, 1_000, 100, &owner, &s, 60, &None).unwrap();
        let b = derive_partial_escrow_id(&env, &token, 1_000, 200, &owner, &s, 60, &None).unwrap();
        assert_ne!(a, b, "different initial payments must not alias");
    }

    #[test]
    fn partial_and_full_escrow_ids_never_collide() {
        let env = Env::default();
        let (token, owner) = (Address::generate(&env), Address::generate(&env));
        let s = salt(&env);
        // amount_due == amount and initial_payment == amount: same surface
        // parameters, but the domain tags must keep the two schemes apart.
        let full = derive_escrow_id(&env, &token, 1_000, &owner, &s, 60, &None).unwrap();
        let partial =
            derive_partial_escrow_id(&env, &token, 1_000, 1_000, &owner, &s, 60, &None).unwrap();
        assert_ne!(full, partial);
    }
}
