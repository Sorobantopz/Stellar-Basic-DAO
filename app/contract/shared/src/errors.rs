use soroban_sdk::contracterror;

/// Core contract error codes (≤ 32 variants for Soroban compatibility).
///
/// Includes most frequently referenced escrow, dispute, and stealth codes.
/// Code bands:
/// - 100-199: validation
/// - 200-299: auth/admin
/// - 300-399: essential escrow/state/fee
/// - 400-499: stealth
/// - 500-599: replay/upgrade
/// - 900-999: internal
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum StellarBasicDAOError {
    // Validation failures (100-199)
    InvalidAmount = 100,
    InvalidSalt = 101,
    // Auth/admin failures (200-299)
    Unauthorized = 200,
    AlreadyInitialized = 201,
    InsufficientRole = 202,
    InvalidRoleState = 203,
    NoPendingAdminTransfer = 204,
    // Essential escrow & state (300-399)
    ContractPaused = 300,
    CommitmentNotFound = 302,
    CommitmentAlreadyExists = 303,
    AlreadySpent = 304,
    CommitmentMismatch = 306,
    EscrowExpired = 307,
    EscrowNotExpired = 308,
    InvalidOwner = 309,
    NoArbiter = 310,
    InvalidDisputeState = 311,
    OperationPaused = 313,
    InvalidContractVersion = 314,
    Overpayment = 315,
    ReentrancyDetected = 316,
    ArbiterAlreadyVoted = 320,
    InsufficientVotes = 321,
    InvalidFeeConfiguration = 322,
    InvalidThreshold = 326,
    DuplicateArbiter = 327,
    TooManyArbiters = 328,
    // Stealth (400-499)
    StealthAddressMismatch = 400,
    // Internal (900-999)
    InternalError = 900,
    InvalidTimeout = 901,
    // Replay protection (500-599)
    NonceAlreadyUsed = 500,
    SignatureExpired = 501,
}

/// Detailed escrow, fee, and stealth error codes (≤ 16 variants).
///
/// Less-commonly referenced error codes split from [`StellarBasicDAOError`]
/// to keep each error enum under Soroban's variant limit.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EscrowError {
    PrivacyAlreadySet = 301,
    InvalidCommitment = 305,
    NotArbiter = 312,
    NotAnArbiter = 319,
    HookAlreadyRegistered = 317,
    HookNotRegistered = 318,
    FeeSplitExceedsTotal = 323,
    DisputeNotExpired = 324,
    NoDisputeExpiry = 325,
    PayloadTooLarge = 329,
    TooManyFeeRecipients = 330,
    TooManyTokens = 331,
    StealthAddressAlreadyUsed = 401,
    StealthEscrowNotFound = 402,
}

/// Governance-specific error codes (≤ 16 variants).
///
/// Upgrade gating and DAO multisig governance errors separated to keep
/// the core error enum under the variant limit. Codes 500/501 mirror the
/// replay-protection codes of [`StellarBasicDAOError`] so governance callers
/// get the same precise nonce/expiry diagnostics.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum GovernanceError {
    /// Replay protection: the signer has already consumed this nonce.
    NonceAlreadyUsed = 500,
    /// The signed action (or proposal) is no longer valid — `valid_until` has passed.
    SignatureExpired = 501,
    UpgradeWindowNotActive = 502,
    UpgradeAlreadyInProgress = 503,
    UpgradeNotInProgress = 504,
    NotASigner = 505,
    ProposalAlreadyExists = 506,
    ProposalNotFound = 507,
    InvalidProposalState = 508,
    AlreadyApproved = 509,
    InsufficientApprovals = 510,
    ExpiryTooFar = 511,
    InvalidSignerSet = 512,
    InvalidGovernanceThreshold = 513,
    DuplicateSigner = 514,
}
