import request from 'supertest';
import app from './server';

describe('GET /api (route index)', () => {
  it('describes the available endpoints', async () => {
    const res = await request(app).get('/api').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.name).toContain('API');
    expect(res.body.endpoints.learningPaths).toBe('/api/courses/learning-paths');
    expect(res.body.endpoints.byId).toContain(':id');
    expect(res.body.health).toBe('/health');
  });
});
