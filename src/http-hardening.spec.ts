import request from 'supertest';
import app from './server';

describe('HTTP hardening', () => {
  it('sends helmet security headers on API responses', async () => {
    const res = await request(app)
      .get('/api/courses/learning-paths')
      .expect(200);

    // MIME sniffing protection (helmet.noSniff)
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // Frame/clickjacking protection
    expect(res.headers['x-frame-options']).toBeDefined();
    // No server advertising
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('echoes a correlation id on every response', async () => {
    const res = await request(app)
      .get('/api/courses/learning-paths')
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('allows caching of the static catalog with a bounded max-age', async () => {
    const res = await request(app)
      .get('/api/courses/learning-paths')
      .expect(200);

    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/);
  });
});
