# 🌟 Stellar Basic DAO

> **A fully decentralized, learn-to-earn Rust programming academy on the Stellar blockchain. Learners earn XLM by completing tasks, tutors earn for teaching, and all rewards, credentials, and governance are trustlessly enforced by Soroban smart contracts.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built on Stellar](https://img.shields.io/badge/Blockchain-Stellar-blueviolet?logo=stellar)](https://stellar.org)
[![Soroban Contracts](https://img.shields.io/badge/Smart%20Contracts-Soroban%20SDK%20v23-orange)](https://soroban.stellar.org)
[![NestJS Backend](https://img.shields.io/badge/Backend-NestJS%2010-red?logo=nestjs)](https://nestjs.com)
[![Next.js Frontend](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=nextdotjs)](https://nextjs.org)
[![Rust](https://img.shields.io/badge/Smart%20Contracts-Rust-orange?logo=rust)](https://www.rust-lang.org)
[![Expo Mobile](https://img.shields.io/badge/Mobile-Expo%2054-blue?logo=expo)](https://expo.dev)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444)](https://turbo.build)

---

## 🌐 What Is Stellar Basic DAO?

Stellar Basic DAO is the first open-source, decentralized programming education platform on the Stellar network. It combines structured Rust education, AI-powered mentoring, Web3 incentive mechanics, and a vibrant social community — all in one platform.


- 📚 **Learn Rust** — Structured paths from beginner to Soroban/Web3 expert
- 💰 **Earn XLM** — Complete tasks and receive on-chain XLM rewards via Soroban escrow
- 🧑‍🏫 **Teach & Earn** — Build courses, review submissions, and earn from your expertise
- 🤖 **AI Mentor** — Claude-powered guidance, code review, and personalized hints
- 🔗 **On-Chain Credentials** — Certificates and badges minted as on-chain Soroban tokens
- 🗳️ **DAO Governance** — M-of-N multisig governance for all privileged protocol actions
- 📱 **Mobile-First** — React Native / Expo app for iOS and Android

Stellar Basic DAO is unique on Stellar: no other project combines Rust education, XLM-based incentive mechanics, AI tutoring, social community, and trustless governance in a single full-stack platform.

---

## ✨ Core Feature Overview

### 🎓 Learning Academy
- **Structured Learning Paths** — Beginner → Intermediate → Advanced → Soroban/Web3
- **Interactive Code Editor** — Browser-based Rust sandbox powered by WebAssembly
- **AI-Graded Submissions** — Task submissions reviewed by Claude + tutor confirmation
- **Progress & Streaks** — XP, streak bonuses, completion percentages
- **Quizzes & Challenges** — Multiple-choice, fill-in-blank, and open-ended coding tasks
- **Certification NFTs** — On-chain Soroban-minted completion certificates

### 💰 XLM Reward System (Trustless On-Chain)
- **Learn-to-Earn** — Task completions release XLM from Soroban escrow
- **Tutor Rewards** — Earnings escrowed and released based on course performance
- **Anti-Cheat Oracle** — AI-verified signatures prevent reward farming
- **Escrow Safety** — All funds held in audited Soroban escrow contracts
- **Fee Router** — Per-asset basis-point fees with platform, arbiter, and collector splits
- **Leaderboard Prizes** — Weekly top learners and tutors share prize pools

### 🤖 AI Mentor
- **Chat Interface** — Ask anything about Rust, ownership, lifetimes, Soroban
- **Code Review** — Paste snippets; AI explains errors and improvements
- **Personalized Hints** — Graduated hints without full spoilers
- **Automated Grading** — AI pre-scores submissions before tutor review
- **Learning Path Recommendations** — Next-course suggestions based on progress


### 🧑‍🏫 Tutor System
- **Verified Profiles** — Reputation scores, ratings, and specialties
- **Course Builder** — Drag-and-drop lesson editor with Markdown + code block support
- **Live Sessions** — 1-on-1 and group WebRTC-powered coding sessions
- **Submission Dashboard** — Review queue with AI pre-scoring

### 🗣️ Social Community
- **Developer Feed** — Post Rust tips, code snippets, and project showcases
- **Follow & Interact** — Twitter/X-style social interactions
- **Study Rooms** — Topic-based group chats (#rust-beginners, #soroban-dev)
- **Weekly Challenges** — Community-voted challenges with bonus XLM

### 🏆 Gamification
- **XP & Levels** — Gain XP for every activity; level up from Rusty Rookie to Soroban Sage
- **Achievement Badges** — On-chain NFT badges (First PR, Speed Coder, Perfect Score, etc.)
- **Leaderboards** — Global, weekly, and course-specific rankings
- **Streak Multipliers** — Daily streak bonuses

### 🌐 Stellar Integration
- **Freighter Wallet** — Connect and sign natively with no friction
- **XLM Dashboard** — Earned rewards, pending payouts, transaction history
- **SAC Token Support** — USDC, AQUA, yXLM and other Stellar assets
- **Path Payments** — Stellar path payment for flexible cross-asset rewards
- **Soroban Events** — All contract actions emit indexable on-chain events

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│   Next.js 15 Web App         │    React Native / Expo Mobile App    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST / WebSocket
┌──────────────────────────────▼──────────────────────────────────────┐
│                       BACKEND LAYER (NestJS)                         │
│  Auth · Payments · Links · Contracts · Ingestion · Notifications     │
│  Job Queue · Reconciliation · Analytics · Soroban Tooling            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Stellar SDK + Soroban RPC
┌──────────────────────────────▼──────────────────────────────────────┐
│                 STELLAR BLOCKCHAIN LAYER (Modular)                   │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              stellar-dao-shared (no_std rlib)              │     │
│   │     errors · types · storage · events · nonce · escrow_id │     │
│   └────────┬─────────┬─────────┬──────────┬──────────────────┘     │
│            │         │         │          │                          │
│   ┌────────▼──┐ ┌────▼────┐ ┌──▼───┐ ┌───▼──────┐                  │
│   │  Escrow   │ │Governanc│ │ Fee  │ │ Stealth  │                  │
│   │  84 KB    │ │  85 KB  │ │47 KB │ │  55 KB   │                  │
│   │ deposit   │ │proposals│ │config│ │ register │                  │
│   │ withdraw  │ │ signers │ │route │ │ withdraw │                  │
│   │ refund    │ │ admin   │ │oracle│ │  status  │                  │
│   │ dispute   │ │ upgrade │ │collect│ │ cleanup  │                  │
│   └───────────┘ └─────────┘ └──────┘ └──────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                               │ Horizon API
┌──────────────────────────────▼──────────────────────────────────────┐
│               INFRASTRUCTURE & DATA LAYER                            │
│   Supabase (PostgreSQL) · Redis · Sentry · Prometheus · Cloudflare  │
└─────────────────────────────────────────────────────────────────────┘
```


## 🛠️ Technology Stack

### Frontend (`app/frontend/`)
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.5.9 | App Router, SSR, RSC |
| TypeScript | 5 | Type-safe codebase |
| Tailwind CSS | v4 | Utility-first styling |
| React 19 | 19.1.0 | UI framework |
| i18next | 26 | Internationalization |
| Recharts | 3 | Data visualization |
| Vitest | 3 | Unit testing |

### Backend (`app/backend/`)
| Technology | Version | Purpose |
|---|---|---|
| NestJS | 10 | REST API + WebSocket server |
| TypeScript | 5 | Type-safe backend |
| `@stellar/stellar-sdk` | 14.5.0 | Stellar network interaction |
| `@supabase/supabase-js` | 2 | PostgreSQL via Supabase |
| Sentry | 10 | Error monitoring |
| Winston | 3 | Structured logging |
| Prometheus (prom-client) | 15 | Metrics |
| Telegraf | 4 | Telegram bot |
| fast-check | 4 | Property-based fuzz tests |

### Smart Contracts (`app/contract/`)
| Technology | Version | Purpose |
|---|---|---|
| Soroban SDK | 23 | Stellar smart contract framework |
| Rust | stable | Contract language (`no_std`) |
| BLAKE3 | 1.5 | Build manifest source hash |
| Target | `wasm32-unknown-unknown` | Compiled WASM artifact |

### Mobile (`app/mobile/`)
| Technology | Version | Purpose |
|---|---|---|
| Expo | ~54 | React Native framework |
| React Native | 0.81.5 | Mobile UI |
| expo-router | ~6 | File-based navigation |
| `@stellar/stellar-base` | 14 | Stellar transaction building |
| expo-secure-store | 55 | Key/credential storage |
| expo-local-authentication | 55 | Biometric auth |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Local and production containers |
| GitHub Actions | CI/CD pipelines |
| Vercel | Frontend hosting — `https://frontend-blue-nu-kqspbfet91.vercel.app` |
| Render | Backend API hosting — `https://stellar-basic-dao-backend.onrender.com` |
| Cloudflare R2 | Media/asset storage |
| Turborepo 2 | Monorepo build orchestration |
| pnpm 10 | Fast, disk-efficient package manager |


---

## ⚡ Soroban Smart Contracts — Modular Architecture

The on-chain logic is deployed as **4 independent sub-contracts** sharing a common `stellar-dao-shared` crate. This modular architecture keeps each WASM artifact under Soroban's deployment limits (~64–85 KB) while maintaining clean separation of concerns.

### 🚀 Deployment Status (Stellar Testnet — Protocol 27)

| # | Contract | Size | Contract ID | Key Functions Verified |
|:---|:---|:---|:---|:---|
| 1 | **stellar-dao-escrow** | 84 KB | `CARWR7ZW...27PMF` | deposit, withdraw, refund, dispute, batch, privacy, get_escrow_details, health_check |
| 2 | **stellar-dao-governance** | 85 KB | `CDR27RYZ...LLVAPF` | initialize, get_admin, get_version, is_paused, proposals, upgrade gating, health_check |
| 3 | **stellar-dao-stealth** | 55 KB | `CBQQ7MXK...RKFWBD` | register_ephemeral_key, stealth_withdraw, get_stealth_status, health_check |
| 4 | **stellar-dao-fee** | 47 KB | `CBYSO64O...Z5LBNU` | set_fee_config, get_fee_config, set_per_asset_fee, oracle fees, rotate_fee_collector, health_check |

> **Deployer account**: `GDFFOJHT2ARW23Y4QUSPEKVKHCRFKDA6DOYN7CK6PROAB3JYRJXYG7AL`  
> **All contracts verified with on-chain deposit/withdraw, governance init, fee config, and stealth status checks.**

### Escrow State Machine

```
[*] ──► Pending
          │
          ├──► Spent     (withdraw — proof verified, funds released)
          │
          ├──► Refunded  (refund — after expires_at)
          │
          └──► Disputed
                 │
                 ├──► Spent    (resolve_dispute → pay recipient)
                 └──► Refunded (resolve_dispute → pay owner)
```

### Contract Function Surface

#### Escrow Sub-contract (`stellar-dao-escrow`)

| Category | Functions |
|---|---|
| **Deposit** | `deposit`, `deposit_with_commitment`, `deposit_partial`, `deposit_with_arbiters`, `partial_payment` |
| **Withdraw** | `withdraw`, `refund` |
| **Dispute** | `dispute`, `vote_for_dispute`, `resolve_dispute`, `resolve_dispute_multi_sig` |
| **TTL / Cleanup** | `extend_escrow_ttl`, `cleanup_escrow` |
| **Privacy** | `set_privacy`, `get_privacy`, `get_escrow_details` |
| **Health** | `health_check` |

#### Governance Sub-contract (`stellar-dao-governance`)

| Category | Functions |
|---|---|
| **Admin** | `initialize`, `set_admin`, `propose_admin_transfer`, `accept_admin_transfer`, `cancel_admin_transfer`, `get_admin` |
| **Pause** | `set_paused`, `is_paused`, `pause_features`, `unpause_features` |
| **Roles** | `grant_role`, `revoke_role`, `clear_roles`, `get_roles` |
| **Upgrade** | `set_upgrade_window`, `get_upgrade_window`, `start_upgrade`, `upgrade`, `cancel_upgrade`, `complete_upgrade`, `migrate` |
| **Proposals** | `create_proposal`, `approve_proposal`, `execute_proposal`, `cancel_proposal` |
| **Signers** | `get_signer_set`, `get_governance_threshold`, `is_governance_signer`, `get_governance_proposal` |
| **Metadata** | `get_deployment_metadata`, `get_contract_health`, `get_feature_flags`, `get_upgrade_state`, `get_supported_versions`, `check_schema_compatibility`, `get_version` |
| **Health** | `health_check` |

#### Fee Router Sub-contract (`stellar-dao-fee`)

| Category | Functions |
|---|---|
| **Fee Config** | `set_fee_config`, `get_fee_config`, `set_per_asset_fee`, `get_per_asset_fee` |
| **Oracle Fees** | `set_oracle_fee_config`, `get_oracle_fee_config` |
| **Wallet** | `set_platform_wallet`, `get_platform_wallet` |
| **Collector** | `rotate_fee_collector`, `get_active_fee_collector` |
| **Health** | `health_check` |

#### Stealth Sub-contract (`stellar-dao-stealth`)

| Category | Functions |
|---|---|
| **Deposit** | `register_ephemeral_key` |
| **Withdraw** | `stealth_withdraw` |
| **Status** | `get_stealth_status`, `cleanup_stealth_escrow` |
| **Health** | `health_check` |

### On-Chain Event Schema (v2)

Every event carries a stable `event_type_id` that never changes across releases:

| Domain | Events |
|---|---|
| **Escrow** (1–9) | EscrowDeposited (1), EscrowWithdrawn (2), EscrowRefunded (3), EscrowDisputed (4), EscrowFinalized (5), PartialPayment (6) |
| **Dispute** (10–19) | ArbiterVoteCast (10), DisputeResolved (11), DisputeAutoResolved (13) |
| **Privacy** (20–29) | PrivacyToggled (20) |
| **Stealth** (30–39) | EphemeralKeyRegistered (30), StealthWithdrawn (31) |
| **Admin** (40–79) | AdminChanged (40), ContractInitialized (41), ContractMigrated (42), ContractPaused (43), ContractUpgraded (44), EmergencyModeActivated (45), FeeConfigChanged (47), UpgradeStarted (53), UpgradeCompleted (54) |


---

## 📁 Monorepo Structure

```
stellar-basic-dao/
├── app/
│   ├── backend/              # NestJS backend API (Stellar + Supabase)
│   │   ├── src/
│   │   │   ├── analytics/
│   │   │   ├── auth/
│   │   │   ├── contracts/    # Soroban contract client wrappers
│   │   │   ├── ingestion/    # Horizon event ingestion
│   │   │   ├── job-queue/    # Custom background job system
│   │   │   ├── links/        # Payment link generation
│   │   │   ├── payments/
│   │   │   ├── reconciliation/
│   │   │   ├── soroban-tooling/
│   │   │   ├── stellar/
│   │   │   └── ...           # 35+ modules total
│   │   └── docs/             # openapi.yaml + API reference docs
│   │
│   ├── contract/             # Soroban smart contracts (Rust workspace)
│   │   ├── Cargo.toml         # Workspace manifest (6 members)
│   │   ├── shared/            # stellar-dao-shared (no_std rlib)
│   │   │   └── src/
│   │   │       ├── errors.rs      # Error codes (StellarBasicDAOError, GovernanceError)
│   │   │       ├── types.rs       # EscrowEntry, FeeConfig, Role, ProposalAction, etc.
│   │   │       ├── storage.rs     # Storage keys, get/set helpers, TTL management
│   │   │       ├── events.rs      # Event schema (v2 with replay fields)
│   │   │       ├── nonce.rs       # Per-signer nonce replay protection
│   │   │       ├── commitment.rs  # Amount commitment hashing
│   │   │       └── escrow_id.rs   # Deterministic escrow ID derivation
│   │   ├── escrow/            # stellar-dao-escrow (84KB)
│   │   │   └── src/
│   │   │       ├── escrow.rs      # Deposit, withdraw, refund, partial payment
│   │   │       ├── dispute.rs     # Dispute resolution (single + multi-sig)
│   │   │       ├── hook.rs        # Event hooks and reentrancy guard
│   │   │       ├── privacy.rs     # Privacy-aware escrow views
│   │   │       └── batch.rs       # Batch create, release, refund
│   │   ├── governance/        # stellar-dao-governance (85KB)
│   │   │   ├── build.rs          # Build manifest (GIT_HASH, BUILD_TIMESTAMP)
│   │   │   └── src/
│   │   │       ├── governance.rs  # Multisig proposals, signers, threshold
│   │   │       ├── admin.rs       # Admin/role management, upgrade gating
│   │   │       └── metadata.rs    # Deployment metadata, health, feature flags
│   │   ├── fee/               # stellar-dao-fee (47KB)
│   │   │   └── src/
│   │   │       ├── fee.rs         # Fee calculation helpers
│   │   │       ├── fee_router.rs  # Payout routing, collector rotation
│   │   │       └── oracle.rs      # Oracle price feed integration
│   │   ├── stealth/           # stellar-dao-stealth (55KB)
│   │   │   └── src/
│   │   │       └── stealth.rs     # Stealth address deposit/withdraw
│   │   ├── contracts/legacy/  # ⚠️ Archived monolithic contract → see `legacy` branch
│   │   ├── documentation/     # Deployment playbook, secrets, env registry
│   │   └── scripts/           # deploy-testnet.sh for sub-contracts
│   │
│   ├── frontend/             # Next.js 15 web app
│   │   └── src/app/          # App Router pages
│   │
│   └── mobile/               # React Native + Expo app
│
├── BackendAcademy/           # Standalone NestJS academy backend
│   └── src/                  # Courses, lessons, AI grading, etc.
│
├── docs/                     # Project-level documentation
│   ├── ARCHITECTURE.md
│   ├── SMART-CONTRACTS.md
│   ├── BACKEND.md
│   ├── FRONTEND.md
│   ├── GOVERNANCE.md
│   ├── INVARIANTS.md
│   ├── MVP-CONTRACT-SCOPE.md
│   └── MVP-ROADMAP.md
│
├── .github/
│   └── workflows/            # CI/CD: backend, frontend, contract, CD
│
├── .kiro/specs/              # Feature design specs
├── turbo.json                # Turborepo task configuration
├── pnpm-workspace.yaml       # Workspace definition
├── render.yaml               # Render deployment config (backend)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | LTS recommended |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Rust | stable | `rustup update stable` |
| Stellar CLI | latest | `cargo install --locked stellar-cli` |
| Binaryen (wasm-opt) | ≥ 120 | `wget https://github.com/WebAssembly/binaryen/releases/download/version_120/binaryen-version_120-x86_64-linux.tar.gz` |
| Docker | latest | For PostgreSQL + Redis |
| Freighter | browser ext | [freighter.app](https://freighter.app) |


### Installation

```bash
# 1. Clone
git clone https://github.com/Stellar-Basic-DAO/Stellar-Basic-DAO.git
cd Stellar-Basic-DAO

# 2. Install all workspace dependencies
pnpm install

# 3. Copy environment files
cp app/backend/.env.example app/backend/.env

# BackendAcademy does not yet have a .env.example file.
# Create one manually when needed:
# cp BackendAcademy/.env.example BackendAcademy/.env

# 4. Start local infrastructure (PostgreSQL + Redis)
docker-compose up -d

# 5. Run development servers
pnpm dev
```

### Running Individual Apps

```bash
pnpm --filter frontend dev      # Web → http://localhost:3000
pnpm --filter backend dev       # API → http://localhost:4000
pnpm --filter mobile start      # Mobile (Expo)
```

### Building Soroban Contracts

```bash
cd app/contract

# Build all 4 sub-contracts
cargo build --target wasm32-unknown-unknown --release \
  -p stellar-dao-escrow \
  -p stellar-dao-governance \
  -p stellar-dao-fee \
  -p stellar-dao-stealth

# Run all contract tests
cargo test

# Optimize WASM for Soroban deployment (requires wasm-opt / Binaryen v120)
wasm-opt \
  --disable-reference-types --disable-exception-handling \
  --disable-simd --disable-multivalue --disable-bulk-memory \
  -Oz \
  target/wasm32-unknown-unknown/release/stellar_dao_escrow.wasm \
  -o target/wasm32-unknown-unknown/release/stellar_dao_escrow.optimized.wasm

# Deploy to Stellar Testnet (per sub-contract)
stellar contract deploy \
  --network testnet \
  --source deployer-testnet \
  --wasm target/wasm32-unknown-unknown/release/stellar_dao_escrow.optimized.wasm

# Or use the automated deployment script
bash scripts/deploy-testnet.sh
```

#### CI/CD Automated Deployment

The `.github/workflows/contract-deploy.yml` workflow builds all 4 sub-contracts in a matrix, optimizes with wasm-opt, verifies WASM sizes, and deploys each independently. See `app/contract/documentation/SECRETS.md` for required GitHub Secrets (`TESTNET_DEPLOY_KEY`, `TESTNET_ADMIN_KEY`).

---

## 🧪 Testing

```bash
# All tests
pnpm test

# Backend unit tests
pnpm --filter backend test:unit

# Backend integration tests
pnpm --filter backend test:int

# Backend fuzz tests
pnpm --filter backend test:fuzz

# Smart contract tests (Rust)
cd app/contract && cargo test

# Frontend tests (Vitest)
pnpm --filter frontend test
```

---

## 🗳️ DAO Governance

All privileged contract actions — pausing, upgrades, fee configuration, admin rotation — are gated behind a threshold M-of-N multisig governance system.

**Proposal lifecycle:**
```
create_proposal() → approve_proposal() [×N] → execute_proposal()
                                            └→ cancel_proposal()
```

Governance state is stored fully on-chain. Proposals expire after a configurable window (max 30 days). All lifecycle events are emitted with stable `event_type_id` values for indexer consumption.

See [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) for the full specification.

---

## 🔒 Security & Financial Invariants

The contract enforces 10 core financial invariants (see [`docs/INVARIANTS.md`](docs/INVARIANTS.md)):

- **INV-01** Conservation of value — no funds created or destroyed outside protocol actions
- **INV-02** No unauthorized withdrawals — only designated recipients can claim funds
- **INV-03** No overpayment — released amount never exceeds the deposited amount
- **INV-04** No double-settlement — each escrow settles exactly once
- **INV-05** Valid state transitions only — the escrow state machine is strictly enforced
- **INV-06** Expiry monotonicity — expired escrows cannot be fulfilled
- **INV-07** Nonce uniqueness — replay attacks are rejected via per-signer nonces
- **INV-08** Authorization consistency — all state transitions require correct authorization
- **INV-09** Zero-amount safety — zero-amount escrows follow the same machine, no transfers
- **INV-10** Fee ceiling — collected fees never exceed the configured maximum

---

## 💡 Why Stellar?

| Reason | Detail |
|---|---|
| **Speed** | 3–5 second settlement — ideal for micro-reward payouts |
| **Cost** | Near-zero transaction fees enable high-frequency micro-payments |
| **Soroban** | Rust-based smart contracts — learners build what they're learning |
| **XLM Reach** | Global asset — learners worldwide receive rewards without bank accounts |
| **Freighter UX** | Low-friction Web3 onboarding for developers new to crypto |
| **SAC Tokens** | USDC, AQUA, and other assets via Stellar Asset Contracts |
| **Path Payments** | Flexible cross-asset reward distribution |

---

## 🗺️ Roadmap

### Phase 1 — Foundation ✅
- Monorepo setup with Turborepo + pnpm
- CI/CD pipelines (GitHub Actions: backend, frontend, contract, deploy, CD)
- ✅ **Modular Soroban contracts** — 4 sub-contracts (escrow 84KB, governance 85KB, stealth 55KB, fee 47KB)
- ✅ **Testnet deployment** — all 4 contracts verified on-chain (Protocol 27)
- Escrow: deposit, withdraw, refund, dispute, partial payment, batch ops
- Governance: multisig proposals, signer management, admin roles, upgrade gating
- Fee router: per-asset fee config, oracle integration, collector rotation
- Stealth: stealth address deposits with ephemeral key registration
- Privacy levels and privacy-aware escrow views
- ✅ **Frontend deployed** — Next.js 15 app live on Vercel → [`https://frontend-blue-nu-kqspbfet91.vercel.app`](https://frontend-blue-nu-kqspbfet91.vercel.app)
- ✅ **Backend fix** — corrected start path (`dist/src/main`), added `render.yaml`, `@types/express` pinned
- Backend API (NestJS + Supabase) — deploy via `render.yaml` (requires `SUPABASE_URL` + `SUPABASE_ANON_KEY` secrets in Render dashboard)

### Phase 2 — Academy Core 🚧
- Course + lesson data model and API
- AI-graded task submissions (Claude API)
- XLM reward pool integration with oracle verification
- Freighter wallet integration on web and mobile

### Phase 3 — Social & Governance
- Community feed, follow, chat
- Certificate NFT minting
- Multisig governance contract (on-chain proposal lifecycle)
- Leaderboards and gamification

### Phase 4 — Ecosystem
- DAO-governed curriculum
- Live tutor sessions (WebRTC)
- Cross-chain certificate portability
- Stellar Basic DAO SDK for third-party integrations

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request against `main`

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed guidelines.

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built with 🦀 Rust, 💙 Stellar, and ❤️ for developers everywhere</strong><br/>
  <a href="https://github.com/Stellar-Basic-DAO/Stellar-Basic-DAO">GitHub</a> •  <a href="https://discord.gg/stellar-basic-dao">Discord</a> •
  <a href="https://twitter.com/stellar_basic_dao">Twitter</a>
</div>
