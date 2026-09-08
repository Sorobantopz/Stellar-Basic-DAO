/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Limits notification dispatches to `maxPerWindow` per `windowMs`
 * per `(publicKey, channel)` key.  This runs in-process; for a
 * multi-instance deployment, swap the Map for a Redis ZSET.
 *
 * WARNING: Rate limit state is lost on server restart.
 * NOT suitable for production multi-instance deployments.
 * Migrate to Redis-backed rate limiting (@nestjs/throttler) for production.
 */
export class NotificationRateLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(
    /** Maximum notifications allowed within the window. */
    private readonly maxPerWindow: number = 10,
    /** Window duration in milliseconds (default 1 hour). */
    private readonly windowMs: number = 60 * 60 * 1_000,
  ) {}

  /**
   * Returns true if the notification should be allowed, false if rate-limited.
   * Calling this method is a side-effect: it records the attempt if allowed.
   */
  allow(publicKey: string, channel: string): boolean {
    const key = `${publicKey}:${channel}`;
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const timestamps = (this.windows.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= this.maxPerWindow) {
      return false;
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);
    return true;
  }

  /**
   * Drop state for keys with no activity within the window.
   *
   * Without pruning, every distinct (publicKey, channel) pair that ever
   * dispatches a notification would keep its timestamp array in memory
   * forever, so the Map grows without bound over the process lifetime.
   * Called periodically by NotificationService so long-idle recipients
   * release their limiter entries.
   */
  pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.windows) {
      const active = timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        this.windows.delete(key);
      } else if (active.length !== timestamps.length) {
        this.windows.set(key, active);
      }
    }
  }

  /** Number of distinct tracked (publicKey, channel) keys. */
  get size(): number {
    return this.windows.size;
  }

  /** For testing: clear all state. */
  reset(): void {
    this.windows.clear();
  }
}