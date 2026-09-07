import { Router } from 'express';
import { learningPathController } from './controller';

const router = Router();

// Learning-path data is a static catalog that changes only on deploy, so
// successful GET responses may be cached briefly by clients and CDNs.
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// Static routes MUST come before parameterized /:id to avoid route shadowing

// GET /api/courses/learning-paths
router.get('/learning-paths', learningPathController.getAllLearningPaths.bind(learningPathController));

// GET /api/courses/learning-paths/summary
router.get('/learning-paths/summary', learningPathController.getLearningPathSummary.bind(learningPathController));

// GET /api/courses/learning-paths/track/:track
router.get('/learning-paths/track/:track', learningPathController.getLearningPathsByTrack.bind(learningPathController));

// GET /api/courses/learning-paths/recommendation/:currentLevel
router.get('/learning-paths/recommendation/:currentLevel', learningPathController.getNextPathRecommendation.bind(learningPathController));

// Parameterized routes (must come after static routes)
// GET /api/courses/learning-paths/:id
router.get('/learning-paths/:id', learningPathController.getLearningPathById.bind(learningPathController));

export default router;