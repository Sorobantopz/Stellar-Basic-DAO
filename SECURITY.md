# Security Policy & Audit Report

> **Stellar Basic DAO** — Security posture, audit findings, and vulnerability reporting.

---

## Supported Versions

| Version | Status |
|---------|--------|
| 0.x (development) | ⚠️ Not ready for production — in-memory stores, DevAuthGuard bypass |
| 1.0 (planned) | 🔒 Target: production-ready with full JWT auth, TypeORM, and audit trail |
| 0.2.0 (current) | 🟡 Pre-production hardening — DevAuthGuard fail-closed, JWT required, frozed-lockfiles |

---

## Reporting a Vulnerability

Please report security vulnerabilities by opening a **private advisory** on GitHub:

1. Go to https://github.com/Stellar-Basic-DAO/Stellar-Basic-DAO/security/advisories
2. Click **"New advisory"**
3. Provide a clear description, reproduction steps, and impact assessment

You can also email the maintainers directly at the project's GitHub organization.

We aim to respond within **72 hours** and issue a fix within **7 days** for critical issues.

---

## Security Audit Findings (BackendAcademy)

Below are the findings from the latest security audit of the `BackendAcademy/` NestJS module.

### 🔴 Critical

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| AUTH-01 | **No authentication guards on sensitive endpoints** — wallet, rewards, contracts, and admin controllers lack auth guards | `wallet.controller.ts`, `rewards.controller.ts`, `contracts.controller.ts`, `admin.controller.ts` | ✅ **Fixed**: JwtAdminGuard/JwtLearnerGuard applied on all controllers |
| AUTH-02 | **Anti-cheat batch endpoint accepts unbounded array** — `check-batch` receives `CheckSubmissionDto[]` without `@ValidateNested({ each: true })` wrapper | `anti-cheat.controller.ts` | ✅ **Fixed**: ParseArrayPipe with maxSize, JwtAdminGuard, RolesGuard applied |

### 🟠 High

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| LOG-01 | **Session/user IDs logged by server** — `@Query()` parameters are recorded in access logs | `auth-session.controller.ts` (`logout`, `logout-all`) | ✅ **Fixed**: Changed to `@Body()` |
| RATE-01 | **Unbounded leaderboard query** — `topN` parameter accepts any value | `rewards.controller.ts` | ✅ **Fixed**: Clamped to [1, 1000] |

### 🟡 Medium

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| VAL-01 | **No input size limits on DTO string fields** — Several DTOs allow unbounded strings | Multiple DTOs | ✅ **Fixed**: `@MaxLength()` decorators added to all DTO string fields |
| VAL-02 | **Batch operations lack request size limits** — No limit on batch sizes for anti-cheat, badge issuance | `anti-cheat.controller.ts`, `badges.controller.ts` | ✅ **Fixed**: Batch size limits added, JWT guards with rate limiting applied |

---

## Cross-Module Fixes (September 2026)

Fixes applied across the monorepo during the September 2026 hardening pass.

| ID | Finding | Module | Status |
|----|---------|--------|--------|
| CONTRACT-01 | **Multi-sig escrows could never be disputed** — `dispute()` only accepted the single `arbiter` field, so escrows created via `deposit_with_arbiters` (arbiter set is `None`) could never enter `Disputed` | `app/contract/escrow` | ✅ **Fixed**: multi-sig arbiter sets are checked for dispute authorization |
| CONTRACT-02 | **Governance masked every error** — contract ABI collapsed all failures to `InternalError` and nonce/replay violations were reported as `NotASigner`, defeating off-chain error handling | `app/contract/governance`, `shared` | ✅ **Fixed**: distinct error codes surfaced through the ABI |
| CONTRACT-03 | **Invalid upgrade windows silently ignored** — `set_upgrade_window` swallowed malformed windows and reported success | `app/contract/shared` | ✅ **Fixed**: validates and returns an error; callers propagate it |
| CONTRACT-04 | **Pause/reentrancy guards never enforced** — guards existed but no money-moving flow checked them, contrary to the documented design | `app/contract/escrow` | ✅ **Fixed**: pause/emergency guards wired into mutating escrow flows |
| MOBILE-01 | **Plaintext PIN fallback** — when no crypto provider loaded, `hashPin` returned `"<salt>:<pin>"` and stored the PIN verbatim | `app/mobile/services/security.ts` | ✅ **Fixed**: refuses to store a PIN without a real digest |
| MOBILE-02 | **No brute-force protection on PIN** — unlimited attempts, string-compare verification | `app/mobile/services/security.ts` | ✅ **Fixed**: 5-attempt lockout + constant-time comparison |
| MOBILE-03 | **Crash on malformed payment links** — `decodeURIComponent` on a memo with a lone `%` threw and crashed scan/deep-link flows | `app/mobile/utils/parse-payment-link.ts` | ✅ **Fixed**: safe-decode fallback; strict decimal amount validation |
| MOBILE-04 | **Uncaught errors logged with raw PII** — crash messages containing wallet addresses reached logs verbatim | `app/mobile` | ✅ **Fixed**: global `ErrorUtils` handler scrubs PII; error boundary added |
| WEB-01 | **Missing security headers** — no clickjacking/MIME-sniffing/referrer protections on responses | `app/frontend/middleware.ts` | ✅ **Fixed**: X-Frame-Options, CSP frame-ancestors, nosniff, referrer + permissions policies |
| WEB-02 | **Stellar identifiers not redacted** in web error reports (emails/cards only) | `app/frontend/src/lib/errorReporter.ts` | ✅ **Fixed**: G/C/N addresses and S-prefixed secret keys redacted (secrets first) |
| API-01 | **Internal error messages leaked to clients** — raw `err.message` reached HTTP responses | `src/` root Express API | ✅ **Fixed**: classified error handler; parse errors → 400; request IDs in logs |
| API-02 | **No per-IP rate limiting or security headers** on the root API | `src/server.ts` | ✅ **Fixed**: env-configurable limiter on `/api`; helmet headers; CORS allowlist |

---

## Security Posture by Module

### BackendAcademy (`BackendAcademy/`)

| Module | Auth | Input Validation | Rate Limiting | Data Store | Status |
|--------|------|-----------------|---------------|------------|--------|
| `auth/` | ✅ JWT guards exist | ✅ DTO validation | ❌ Not yet | In-memory | 🟡 Pre-production |
| `wallet/` | ❌ DevAuthGuard only | ✅ DTO validation | ❌ Not yet | In-memory | 🟡 Pre-production |
| `rewards/` | ❌ DevAuthGuard only | ✅ DTO validation | ❌ Not yet | In-memory | 🟡 Pre-production |
| `contracts/` | ❌ DevAuthGuard only | ✅ DTO validation | ❌ Not yet | In-memory | 🟡 Pre-production |
| `admin/` | ❌ DevAuthGuard only | ❌ Minimal | ❌ Not yet | In-memory | 🔴 Needs attention |
| `payments/` | ❌ DevAuthGuard only | ✅ DTO validation | ❌ Not yet | In-memory | 🟡 Pre-production |

### Root src/ (`src/`)

| Component | Status |
|-----------|--------|
| Courses API | ✅ Basic validation, no auth needed (public learning paths) |

---

## Recommended Security Roadmap

### Before Production Launch

1. **Replace `DevAuthGuard`** with real JWT guards (`JwtLearnerGuard`, `JwtAdminGuard`, `JwtTutorGuard`)
2. **Add rate limiting** via `@nestjs/throttler` on all POST endpoints
3. **Migrate in-memory stores** to TypeORM/PostgreSQL for persistence and auditability
4. **Add CSRF protection** for cookie-based auth (if used)
5. **Set up Sentry** error tracking with PII scrubbing
6. **Run dependency audit**: `npm audit` on all packages

### Within First Production Month

7. **Implement API key authentication** for service-to-service calls
8. **Add request logging** with correlation IDs
9. **Set up security headers** (Helmet.js) — already configured in `main.ts`
10. **Configure CORS** restrictively for production origins

---

## Dependency Security

- **pnpm** is used for the monorepo (root) — lockfile should be committed
- **npm** is used for BackendAcademy — `package-lock.json` should be committed
- Run `pnpm audit` and `npm audit` regularly before releases
- Keep Soroban SDK, Stellar SDK, and NestJS dependencies up to date
