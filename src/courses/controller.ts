import { Request, Response } from 'express';
import { learningPathService } from './service';

const TRACKS = ['beginner', 'intermediate', 'advanced'] as const;
type Track = (typeof TRACKS)[number];

function isTrack(value: string): value is Track {
  return (TRACKS as readonly string[]).includes(value);
}

/**
 * Learning-path catalog handlers.
 *
 * Handlers never catch their own errors: Express 5 forwards any thrown
 * error to the central error handler, which produces the standard
 * envelope (no internal detail leakage, requestId attached, full log
 * server-side). Keeping the success paths free of try/catch means error
 * handling lives in exactly one place.
 */
export class LearningPathController {
  /**
   * GET /api/courses/learning-paths
   * Get all learning paths with full metadata
   */
  async getAllLearningPaths(_req: Request, res: Response): Promise<void> {
    const paths = learningPathService.getAllLearningPaths();

    res.status(200).json({
      success: true,
      data: paths,
      count: paths.length
    });
  }

  /**
   * GET /api/courses/learning-paths/:id
   * Get a specific learning path by ID
   */
  async getLearningPathById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const path = learningPathService.getLearningPathById(id);

    if (!path) {
      res.status(404).json({
        success: false,
        error: 'Learning path not found',
        message: `No learning path found with ID: ${id}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: path
    });
  }

  /**
   * GET /api/courses/learning-paths/track/:track
   * Get learning paths by track (beginner, intermediate, advanced)
   */
  async getLearningPathsByTrack(req: Request, res: Response): Promise<void> {
    const track = req.params.track as string;

    if (!isTrack(track)) {
      res.status(400).json({
        success: false,
        error: 'Invalid track parameter',
        message: 'Track must be: beginner, intermediate, or advanced'
      });
      return;
    }

    const paths = learningPathService.getLearningPathsByTrack(track);

    res.status(200).json({
      success: true,
      data: paths,
      track,
      count: paths.length
    });
  }

  /**
   * GET /api/courses/learning-paths/summary
   * Get lightweight summary of all learning paths
   */
  async getLearningPathSummary(_req: Request, res: Response): Promise<void> {
    const summary = learningPathService.getLearningPathSummary();

    res.status(200).json({
      success: true,
      data: summary,
      count: summary.length
    });
  }

  /**
   * GET /api/courses/learning-paths/recommendation/:currentLevel
   * Get the next recommended learning path
   */
  async getNextPathRecommendation(
    req: Request,
    res: Response
  ): Promise<void> {
    const currentLevel = req.params.currentLevel as string;

    if (!isTrack(currentLevel)) {
      res.status(400).json({
        success: false,
        error: 'Invalid level parameter',
        message: 'Level must be: beginner, intermediate, or advanced'
      });
      return;
    }

    const nextPath = learningPathService.getNextPathRecommendation(currentLevel);

    if (!nextPath) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'You are already at the most advanced level'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: nextPath,
      currentLevel,
      nextLevel: nextPath.track
    });
  }
}

export const learningPathController = new LearningPathController();
