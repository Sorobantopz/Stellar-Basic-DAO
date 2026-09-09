//! Unit tests for shared storage helpers that mutate persistent state.

#[cfg(test)]
mod tests {
    use crate::errors::StellarBasicDAOError;
    use crate::storage::{get_upgrade_window, set_upgrade_window};
    use soroban_sdk::{contract, contractimpl, Env};

    #[contract]
    struct StorageTestHost;

    #[contractimpl]
    impl StorageTestHost {}

    fn run_test(f: impl FnOnce(&Env)) {
        let env = Env::default();
        let addr = env.register(StorageTestHost, ());
        env.as_contract(&addr, || f(&env));
    }

    #[test]
    fn valid_window_is_persisted() {
        run_test(|env| {
            set_upgrade_window(env, 1_000, 2_000).expect("valid window must persist");
            assert_eq!(get_upgrade_window(env), (1_000, 2_000));
        });
    }

    #[test]
    fn open_ended_window_allows_zero_end() {
        run_test(|env| {
            set_upgrade_window(env, 1_000, 0).expect("end == 0 means no upper bound");
            assert_eq!(get_upgrade_window(env), (1_000, 0));
        });
    }

    #[test]
    fn unset_window_defaults_to_no_window() {
        run_test(|env| {
            assert_eq!(get_upgrade_window(env), (0, 0));
        });
    }

    #[test]
    fn inverted_window_is_rejected_and_not_persisted() {
        run_test(|env| {
            let err = set_upgrade_window(env, 2_000, 1_000).unwrap_err();
            assert_eq!(err, StellarBasicDAOError::InvalidTimeout);
            // Nothing was written.
            assert_eq!(get_upgrade_window(env), (0, 0));
        });
    }

    #[test]
    fn empty_window_is_rejected_and_not_persisted() {
        run_test(|env| {
            let err = set_upgrade_window(env, 5_000, 5_000).unwrap_err();
            assert_eq!(err, StellarBasicDAOError::InvalidTimeout);
            assert_eq!(get_upgrade_window(env), (0, 0));
        });
    }

    #[test]
    fn overwriting_a_window_replaces_it() {
        run_test(|env| {
            set_upgrade_window(env, 100, 200).unwrap();
            set_upgrade_window(env, 300, 400).unwrap();
            assert_eq!(get_upgrade_window(env), (300, 400));
        });
    }
}
