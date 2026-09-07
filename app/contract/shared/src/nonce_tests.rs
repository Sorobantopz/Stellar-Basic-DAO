//! Unit tests for the signature replay-protection nonce registry.

#[cfg(test)]
mod tests {
    use crate::errors::StellarBasicDAOError;
    use crate::nonce::{is_nonce_used, verify_and_consume};
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{contract, contractimpl, Address, Env};

    #[contract]
    struct NonceTestHost;

    #[contractimpl]
    impl NonceTestHost {}

    fn run_test(f: impl FnOnce(&Env, Address)) {
        let env = Env::default();
        let addr = env.register_contract(None, NonceTestHost);
        let signer = Address::generate(&env);
        env.as_contract(&addr, || f(&env, signer));
    }

    #[test]
    fn first_use_of_nonce_succeeds() {
        run_test(|env, signer| {
            env.ledger().set_timestamp(1_000);
            verify_and_consume(env, &signer, 7, 2_000).expect("fresh nonce must be accepted");
            assert!(is_nonce_used(env, &signer, 7));
        });
    }

    #[test]
    fn replaying_the_same_nonce_is_rejected() {
        run_test(|env, signer| {
            env.ledger().set_timestamp(1_000);
            verify_and_consume(env, &signer, 7, 2_000).unwrap();
            let err = verify_and_consume(env, &signer, 7, 2_000).unwrap_err();
            assert_eq!(err, StellarBasicDAOError::NonceAlreadyUsed);
        });
    }

    #[test]
    fn expired_signatures_are_rejected() {
        run_test(|env, signer| {
            env.ledger().set_timestamp(2_000);
            let err = verify_and_consume(env, &signer, 8, 2_000).unwrap_err();
            assert_eq!(err, StellarBasicDAOError::SignatureExpired);
        });
    }

    #[test]
    fn nonces_are_scoped_per_signer() {
        run_test(|env, signer_a| {
            env.ledger().set_timestamp(1_000);
            let signer_b = Address::generate(env);
            verify_and_consume(env, &signer_a, 9, 2_000).unwrap();
            // The same nonce value is still fresh for a different signer.
            verify_and_consume(env, &signer_b, 9, 2_000)
                .expect("same nonce under a different signer must be accepted");
            assert!(is_nonce_used(env, &signer_a, 9));
            assert!(is_nonce_used(env, &signer_b, 9));
        });
    }
}
