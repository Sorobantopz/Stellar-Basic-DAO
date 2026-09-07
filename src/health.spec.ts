import request from 'supertest';
import app from './server';

describe('GET /health diagnostics', () => {
  it('reports process diagnostics for operators', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.status).toBe('OK');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body.pid).toBeGreaterThan(0);
    expect(res.body.nodeVersion).toMatch(/^v\d+\./);
    expect(res.body.environment).toBeDefined();
    expect(typeof res.body.memory.rssBytes).toBe('number');
    expect(typeof res.body.memory.heapUsedBytes).toBe('number');
  });
});
