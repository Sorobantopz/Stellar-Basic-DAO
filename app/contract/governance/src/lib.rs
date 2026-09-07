#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};

mod admin;
mod governance;
mod metadata;

use stellar_dao_shared::errors::{GovernanceError, StellarBasicDAOError};
use stellar_dao_shared::types::{
    ContractHealth, DeploymentMetadata, FeatureFlags, Role, SchemaCompatibility, SupportedVersions,
    UpgradeState,
};

/// Stellar Basic DAO — Governance Sub-contract
///
/// Handles multisig proposals, admin role management, upgrade gating,
/// and pause/feature-flag configuration.
#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    // ── Admin / Initialization ───────────────────────────────────────

    pub fn initialize(env: Env, admin_addr: Address) -> Result<(), StellarBasicDAOError> {
        admin::initialize(&env, admin_addr)
    }

    pub fn set_paused(
        env: Env,
        caller: Address,
        new_state: bool,
    ) -> Result<(), StellarBasicDAOError> {
        admin::set_paused(&env, caller, new_state)
    }

    pub fn is_paused(env: Env) -> bool {
        admin::is_paused(&env)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        admin::get_admin(&env)
    }

    pub fn set_admin(
        env: Env,
        caller: Address,
        new_admin: Address,
    ) -> Result<(), StellarBasicDAOError> {
        admin::set_admin(&env, caller, new_admin)
    }

    pub fn propose_admin_transfer(
        env: Env,
        caller: Address,
        new_admin: Address,
    ) -> Result<(), StellarBasicDAOError> {
        admin::propose_admin_transfer(&env, caller, new_admin)
    }

    pub fn accept_admin_transfer(env: Env, caller: Address) -> Result<(), StellarBasicDAOError> {
        admin::accept_admin_transfer(&env, caller)
    }

    pub fn cancel_admin_transfer(env: Env, caller: Address) -> Result<(), StellarBasicDAOError> {
        admin::cancel_admin_transfer(&env, caller)
    }

    // ── Pause Flags ──────────────────────────────────────────────────

    pub fn pause_features(
        env: Env,
        caller: Address,
        mask: u64,
    ) -> Result<(), StellarBasicDAOError> {
        admin::set_pause_flags(&env, &caller, mask, 0)
    }

    pub fn unpause_features(
        env: Env,
        caller: Address,
        mask: u64,
    ) -> Result<(), StellarBasicDAOError> {
        admin::set_pause_flags(&env, &caller, 0, mask)
    }

    // ── Role Management ──────────────────────────────────────────────

    pub fn grant_role(
        env: Env,
        caller: Address,
        target: Address,
        role: Role,
    ) -> Result<(), StellarBasicDAOError> {
        admin::grant_role(&env, caller, target, role)
    }

    pub fn revoke_role(
        env: Env,
        caller: Address,
        target: Address,
        role: Role,
    ) -> Result<(), StellarBasicDAOError> {
        admin::revoke_role(&env, caller, target, role)
    }

    pub fn clear_roles(
        env: Env,
        caller: Address,
        target: Address,
    ) -> Result<(), StellarBasicDAOError> {
        admin::clear_roles(&env, caller, target)
    }

    pub fn get_roles(env: Env, account: Address) -> Vec<Role> {
        stellar_dao_shared::storage::get_roles(&env, &account)
    }

    // ── Upgrade Gating ───────────────────────────────────────────────

    pub fn set_upgrade_window(
        env: Env,
        caller: Address,
        start: u64,
        end: u64,
    ) -> Result<(), StellarBasicDAOError> {
        admin::set_upgrade_window(&env, &caller, start, end)
    }

    pub fn get_upgrade_window(env: Env) -> (u64, u64) {
        stellar_dao_shared::storage::get_upgrade_window(&env)
    }

    pub fn start_upgrade(
        env: Env,
        caller: Address,
        new_version: u32,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), StellarBasicDAOError> {
        admin::start_upgrade(&env, &caller, new_version, new_wasm_hash)
    }

    pub fn upgrade(
        env: Env,
        caller: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), StellarBasicDAOError> {
        admin::upgrade(&env, &caller, new_wasm_hash)
    }

    pub fn cancel_upgrade(env: Env, caller: Address) -> Result<(), StellarBasicDAOError> {
        admin::cancel_upgrade(&env, &caller)
    }

    pub fn complete_upgrade(
        env: Env,
        caller: Address,
        new_version: u32,
    ) -> Result<u32, StellarBasicDAOError> {
        admin::complete_upgrade(&env, &caller, new_version)
    }

    // ── Migration ────────────────────────────────────────────────────

    pub fn migrate(env: Env, caller: Address) -> Result<u32, StellarBasicDAOError> {
        admin::migrate(&env, &caller)
    }

    // ── Metadata ─────────────────────────────────────────────────────

    pub fn get_version(env: Env) -> u32 {
        admin::get_version(&env)
    }

    pub fn get_deployment_metadata(env: Env) -> DeploymentMetadata {
        metadata::deployment_metadata(&env)
    }

    pub fn get_contract_health(env: Env) -> ContractHealth {
        metadata::contract_health(&env)
    }

    pub fn get_feature_flags(_env: Env) -> FeatureFlags {
        metadata::feature_flags()
    }

    pub fn get_upgrade_state(env: Env) -> UpgradeState {
        metadata::upgrade_state(&env)
    }

    pub fn get_supported_versions(env: Env) -> SupportedVersions {
        metadata::supported_versions(&env)
    }

    pub fn check_schema_compatibility(
        env: Env,
        requested_contract_version: u32,
        requested_event_schema_version: u32,
    ) -> SchemaCompatibility {
        metadata::check_schema_compatibility(
            &env,
            requested_contract_version,
            requested_event_schema_version,
        )
    }

    // ── Governance Multisig ──────────────────────────────────────────

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        action: governance::ProposalAction,
        nonce: u64,
        valid_until: u64,
    ) -> Result<BytesN<32>, StellarBasicDAOError> {
        governance::create_proposal(&env, proposer, action, nonce, valid_until)
            .map_err(|_| StellarBasicDAOError::InternalError)
    }

    pub fn approve_proposal(
        env: Env,
        caller: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), StellarBasicDAOError> {
        governance::approve_proposal(&env, caller, proposal_id)
            .map_err(|_| StellarBasicDAOError::InternalError)
    }

    pub fn execute_proposal(env: Env, proposal_id: BytesN<32>) -> Result<(), StellarBasicDAOError> {
        governance::execute_proposal(&env, proposal_id)
            .map_err(|_| StellarBasicDAOError::InternalError)
    }

    pub fn cancel_proposal(
        env: Env,
        caller: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), StellarBasicDAOError> {
        governance::cancel_proposal(&env, caller, proposal_id)
            .map_err(|_| StellarBasicDAOError::InternalError)
    }

    pub fn get_signer_set(env: Env) -> Vec<Address> {
        governance::get_signer_set(&env)
    }

    pub fn get_governance_threshold(env: Env) -> u32 {
        governance::get_threshold(&env)
    }

    pub fn get_governance_proposal(
        env: Env,
        proposal_id: BytesN<32>,
    ) -> Option<governance::GovernanceProposal> {
        governance::get_proposal(&env, &proposal_id)
    }

    pub fn is_governance_signer(env: Env, address: Address) -> bool {
        governance::is_signer(&env, &address)
    }

    pub fn health_check() -> bool {
        true
    }
}
