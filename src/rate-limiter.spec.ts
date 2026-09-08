import express from 'express';
import request from 'supertest';
import { createRateLimiter } from './middleware/rate-limiter';
import { requestContext } from './middleware/request-context';

describe('rate limiter', () => {
  function buildApp() {
    const app = express();
    app.use(requestContext);
    // trustProxy lets tests simulate distinct clients via X-Forwarded-For.
    app.use(createRateLimiter({ windowMs: 60_000, max: 3, trustProxy: true }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows requests under the limit and reports remaining budget', async () => {
    const app = buildApp();
    const first = await request(app).get('/ping').expect(200);
    expect(first.headers['x-ratelimit-limit']).toBe('3');
    expect(first.headers['x-ratelimit-remaining']).toBe('2');

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
  });

  it('returns 429 with Retry-After once the limit is exceeded', async () => {
    const app = buildApp();
    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);

    const blocked = await request(app).get('/ping').expect(429);
    expect(blocked.body.error).toBe('Too Many Requests');
    expect(blocked.body.requestId).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('tracks clients independently', async () => {
    const app = buildApp();
    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);

    // A different client (different source IP in supertest) is unaffected.
    const other = await request(app)
      .get('/ping')
      .set('x-forwarded-for', '10.0.0.99')
      .expect(200);
    expect(other.body.ok).toBe(true);
  });

  it('rejects invalid configuration at construction', () => {
    expect(() =>
      createRateLimiter({ windowMs: 0, max: 10 }),
    ).toThrow();
    expect(() =>
      createRateLimiter({ windowMs: 1000, max: 0 }),
    ).toThrow();
  });

  it('reclaims memory from expired buckets once the window passes', async () => {
    jest.useFakeTimers();
    const app = express();
    app.use(requestContext);
    app.use(createRateLimiter({ windowMs: 60_000, max: 100, trustProxy: true }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    // Simulate many distinct clients so the bucket map grows.
    for (let i = 0; i < 50; i += 1) {
      await request(app)
        .get('/ping')
        .set('x-forwarded-for', `10.1.${i}.1`)
        .expect(200);
    }

    // A fresh client still gets a full budget while buckets are unexpired.
    const before = await request(app)
      .get('/ping')
      .set('x-forwarded-for', '10.2.0.1')
      .expect(200);
    expect(before.headers['x-ratelimit-remaining']).toBe('99');

    // After the window elapses, the next request sweeps expired buckets;
    // an old client now starts a fresh window instead of being remembered.
    jest.advanceTimersByTime(61_000);
    const after = await request(app)
      .get('/ping')
      .set('x-forwarded-for', '10.1.0.1')
      .expect(200);
    expect(after.headers['x-ratelimit-remaining']).toBe('99');

    jest.useRealTimers();
  });
});
