import request from 'supertest';
import app from '../server';
import { learningPathService } from './service';

describe('Courses API error path', () => {
  it('routes handler failures to the central error handler', async () => {
    const spy = jest
      .spyOn(learningPathService, 'getAllLearningPaths')
      .mockImplementation(() => {
        throw new Error('DATABASE_SECRET_DETAILS');
      });

    try {
      const res = await request(app)
        .get('/api/courses/learning-paths')
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Internal Server Error');
      // The internal message must not reach the client through the controller.
      expect(JSON.stringify(res.body)).not.toContain('DATABASE_SECRET_DETAILS');
      expect(res.body.requestId).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
});
