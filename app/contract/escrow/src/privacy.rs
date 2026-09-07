use soroban_sdk::{Address, Env, Symbol};
use stellar_dao_shared::errors::StellarBasicDAOError;
use stellar_dao_shared::events::publish_privacy_toggled;
use stellar_dao_shared::storage::{DataKey, PRIVACY_ENABLED_KEY};

fn legacy_privacy_key(env: &Env, owner: &Address) -> (Symbol, Address) {
    (Symbol::new(env, PRIVACY_ENABLED_KEY), owner.clone())
}

fn typed_privacy_key(owner: &Address) -> DataKey {
    DataKey::PrivacyEnabled(owner.clone())
}

fn read_privacy_flag(env: &Env, owner: &Address) -> bool {
    let typed_key = typed_privacy_key(owner);
    if let Some(enabled) = env.storage().persistent().get(&typed_key) {
        return enabled;
    }

    env.storage()
        .persistent()
        .get(&legacy_privacy_key(env, owner))
        .unwrap_or(false)
}

/// Enable or disable privacy for an account.
///
/// Reads the current state first and returns [` StellarBasicDAOError::CommitmentAlreadyExists`]
/// if the requested value matches the current value. Otherwise persists the new
/// state and publishes a [`stellar_dao_shared::events::publish_privacy_toggled`] event.
pub fn set_privacy(env: &Env, owner: Address, enabled: bool) -> Result<(), StellarBasicDAOError> {
    owner.require_auth();

    let current = read_privacy_flag(env, &owner);
    if current == enabled {
        return Err(StellarBasicDAOError::CommitmentAlreadyExists);
    }

    let typed_key = typed_privacy_key(&owner);
    env.storage().persistent().set(&typed_key, &enabled);

    let legacy_key = legacy_privacy_key(env, &owner);
    if env.storage().persistent().has(&legacy_key) {
        env.storage().persistent().remove(&legacy_key);
    }

    publish_privacy_toggled(env, owner, enabled);
    Ok(())
}

/// Return the current boolean privacy state for an account.
///
/// Defaults to `false` if never set.
pub fn get_privacy(env: &Env, owner: Address) -> bool {
    read_privacy_flag(env, &owner)
}
