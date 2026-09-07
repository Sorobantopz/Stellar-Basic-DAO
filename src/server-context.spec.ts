import express from 'express';
import request from 'supertest';
import { accessLogger, requestContext } from './middleware/request-context';

describe('request-context middleware', () => {
  function buildApp() {
    const app = express();
    app.use(requestContext);
    app.use(accessLogger);
    app.get('/ping', (req, res) => res.json({ ok: true, id: req.id }));
    return app;
  }

  it('assigns a request id and echoes it on the response', async () => {
    const res = await request(buildApp()).get('/ping').expect(200);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.id).toBe(res.headers['x-request-id']);
  });

  it('honors a caller-supplied x-request-id', async () => {
    const res = await request(buildApp())
      .get('/ping')
      .set('x-request-id', 'trace-abc-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('trace-abc-123');
    expect(res.body.id).toBe('trace-abc-123');
  });

  it('ignores malformed caller-supplied ids and generates its own', async () => {
    const res = await request(buildApp())
      .get('/ping')
      .set('x-request-id', '../../etc/passwd')
      .expect(200);

    const echoed = res.headers['x-request-id'] as string;
    expect(echoed).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.id).toBe(echoed);
  });

  it('assigns a unique id to each request', async () => {
    const app = buildApp();
    const a = await request(app).get('/ping').expect(200);
    const b = await request(app).get('/ping').expect(200);

    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });
});
