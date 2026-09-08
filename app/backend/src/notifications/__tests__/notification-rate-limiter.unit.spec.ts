import { NotificationRateLimiter } from "../notification-rate-limiter";

describe("NotificationRateLimiter", () => {
  const KEY = "GPUBKEY";

  it("allows requests under the limit", () => {
    const rl = new NotificationRateLimiter(3, 60_000);
    expect(rl.allow(KEY, "email")).toBe(true);
    expect(rl.allow(KEY, "email")).toBe(true);
    expect(rl.allow(KEY, "email")).toBe(true);
  });

  it("blocks at the limit", () => {
    const rl = new NotificationRateLimiter(2, 60_000);
    rl.allow(KEY, "email");
    rl.allow(KEY, "email");
    expect(rl.allow(KEY, "email")).toBe(false);
  });

  it("independent buckets per (publicKey, channel)", () => {
    const rl = new NotificationRateLimiter(1, 60_000);
    expect(rl.allow(KEY, "email")).toBe(true);
    // email is now at limit, but push is not
    expect(rl.allow(KEY, "push")).toBe(true);
    // different user is also independent
    expect(rl.allow("OTHER", "email")).toBe(true);
  });

  it("resets after window expires", () => {
    jest.useFakeTimers();
    const rl = new NotificationRateLimiter(1, 1_000); // 1 second window
    rl.allow(KEY, "email"); // fills up
    expect(rl.allow(KEY, "email")).toBe(false);

    jest.advanceTimersByTime(1_100); // advance past window
    expect(rl.allow(KEY, "email")).toBe(true); // window reset
    jest.useRealTimers();
  });

  it("reset() clears all state", () => {
    const rl = new NotificationRateLimiter(1, 60_000);
    rl.allow(KEY, "email");
    rl.reset();
    expect(rl.allow(KEY, "email")).toBe(true);
  });

  it("pruneExpired() drops keys with no activity in the window", () => {
    jest.useFakeTimers();
    const rl = new NotificationRateLimiter(2, 60_000);

    rl.allow(KEY, "email");
    rl.allow("OTHER", "push");
    expect(rl.size).toBe(2);

    // Advance past the window so both keys are stale.
    jest.advanceTimersByTime(61_000);
    rl.pruneExpired();
    expect(rl.size).toBe(0);
    jest.useRealTimers();
  });

  it("pruneExpired() keeps keys that still have activity in the window", () => {
    jest.useFakeTimers();
    const rl = new NotificationRateLimiter(2, 60_000);

    // KEY goes stale; OTHER is recorded just before the prune runs.
    rl.allow(KEY, "email");
    jest.advanceTimersByTime(61_000);
    rl.allow("OTHER", "push");

    rl.pruneExpired();
    expect(rl.size).toBe(1);
    jest.useRealTimers();
  });

  it("pruneExpired() compacts partially-expired timestamp arrays", () => {
    jest.useFakeTimers();
    const rl = new NotificationRateLimiter(3, 60_000);

    // First entry becomes stale, second stays inside the window.
    rl.allow(KEY, "email");
    jest.advanceTimersByTime(40_000);
    rl.allow(KEY, "email");
    jest.advanceTimersByTime(21_000);

    rl.pruneExpired();
    // Key survives with its fresh timestamp only (array compacted 2 -> 1).
    expect(rl.size).toBe(1);
    expect(rl.allow(KEY, "email")).toBe(true);
    jest.useRealTimers();
  });
});
