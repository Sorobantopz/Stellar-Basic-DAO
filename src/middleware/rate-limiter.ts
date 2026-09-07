import { NextFunction, Request, Response } from 'express';

export interface RateLimiterOptions {
  /** Length of the fixed window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests a single client may make per window. */
  max: number;
  /**
   * Whether to honor X-Forwarded-For. Keep disabled unless the server
   * actually sits behind exactly one trusted reverse proxy.
   */
  trustProxy?: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window per-IP rate limiter (in-memory).
 *
 * Suitable for a single-instance API to blunt brute force and scrape
 * loops. The window state lives in process memory, so limits are
 * per-process — fine for a stateless catalog API, not a replacement for
 * a distributed limiter behind many replicas.
 *
 * On limit breach it responds 429 with Retry-After and standard
 * X-RateLimit-* headers.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, trustProxy = false } = options;
  if (!(windowMs > 0) || !(max > 0)) {
    throw new Error('rate limiter requires positive windowMs and max');
  }

  const buckets = new Map<string, Bucket>();

  function clientKey(req: Request): string {
    if (trustProxy) {
      const forwarded = req.get('x-forwarded-for');
      if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
      }
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }

  return function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = clientKey(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSecs = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSecs));
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry later.',
        requestId: req.id,
        retryAfterSeconds: retryAfterSecs,
      });
      return;
    }

    next();
  };
}

export function pruneExpiredBuckets(
  buckets: Map<string, Bucket>,
  now: number,
): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
