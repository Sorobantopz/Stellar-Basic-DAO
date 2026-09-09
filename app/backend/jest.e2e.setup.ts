/**
 * E2E-only setup. Runs after jest.setup.ts.
 *
 * E2E suites make many rapid requests (e.g. the app.e2e /status sequence),
 * which trips the real CustomThrottlerGuard's public burst limit (10/10s).
 * Guard overrides via overrideProvider don't reliably replace APP_GUARD
 * instances, so instead raise the configured limits far above anything a test
 * suite produces. Rate-limit enforcement itself stays covered by the unit
 * tests in custom-throttler.guard.unit.spec.ts.
 */
process.env.RATE_LIMIT_PUBLIC_BURST_LIMIT = "100000";
process.env.RATE_LIMIT_PUBLIC_BURST_TTL_MS = "1000";
process.env.RATE_LIMIT_PUBLIC_SUSTAINED_LIMIT = "100000";
process.env.RATE_LIMIT_PUBLIC_SUSTAINED_TTL_MS = "1000";
process.env.RATE_LIMIT_AUTHENTICATED_BURST_LIMIT = "100000";
process.env.RATE_LIMIT_AUTHENTICATED_BURST_TTL_MS = "1000";
process.env.RATE_LIMIT_AUTHENTICATED_SUSTAINED_LIMIT = "100000";
process.env.RATE_LIMIT_AUTHENTICATED_SUSTAINED_TTL_MS = "1000";
process.env.RATE_LIMIT_WEBHOOKS_BURST_LIMIT = "100000";
process.env.RATE_LIMIT_WEBHOOKS_BURST_TTL_MS = "1000";
process.env.RATE_LIMIT_WEBHOOKS_SUSTAINED_LIMIT = "100000";
process.env.RATE_LIMIT_WEBHOOKS_SUSTAINED_TTL_MS = "1000";