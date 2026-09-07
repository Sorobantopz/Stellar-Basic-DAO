import express from 'express';
import request from 'supertest';
import { errorHandler } from './middleware/error-handler';
import { requestContext } from './middleware/request-context';
import app from './server';

function probeApp() {
  const probe = express();
  probe.use(express.json({ limit: '1kb' }));
  probe.use(requestContext);
  probe.get('/ok', (_req, res) => res.json({ fine: true }));
  probe.post('/boom', () => {
    throw new Error('SECRET_INTERNAL_DETAILS_12345');
  });
  probe.use(errorHandler);
  return probe;
}

describe('error handling', () => {
  it('returns 400 for malformed JSON bodies instead of 500', async () => {
    const res = await request(app)
      .post('/api/courses/learning-paths/anything')
      .set('Content-Type', 'application/json')
      .send('{"broken": ')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Bad Request');
    // The parser's internal detail must not leak to the client.
    expect(JSON.stringify(res.body)).not.toContain('Unexpected token');
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 413 for oversized JSON bodies', async () => {
    // The probe enforces a 1kb limit, so a 4kb body trips the parser.
    const huge = `{"padding":"${'x'.repeat(4 * 1024)}"}`;
    const res = await request(probeApp())
      .post('/nope')
      .set('Content-Type', 'application/json')
      .send(huge);

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Payload Too Large');
  });

  it('returns 500 without leaking internal error messages', async () => {
    const res = await request(probeApp()).post('/boom').expect(500);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_DETAILS_12345');
    expect(res.body.requestId).toBeDefined();
  });

  it('still serves healthy routes on the probe app', async () => {
    const res = await request(probeApp()).get('/ok').expect(200);
    expect(res.body.fine).toBe(true);
  });
});
