import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DIContainer } from '../../di/container';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';

const DashboardQuerySchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d']).default('24h')
});

export function createTacAnalyticsRoutes(container: DIContainer): Router {
  const router = Router();

  router.get(
    '/dashboard',
    validationMiddleware(DashboardQuerySchema, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!container.analyticsService) {
          throw new Error('AnalyticsService not available');
        }

        const { timeframe } = req.query as any;
        const metrics = await container.analyticsService.getDashboardMetrics(timeframe || '24h');

        res.json({
          success: true,
          data: metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to fetch analytics dashboard', { error: error.message });
        next(error);
      }
    }
  );

  router.get(
    '/users/:userId',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!container.analyticsService) {
          throw new Error('AnalyticsService not available');
        }

        const insights = await container.analyticsService.getUserInsights(req.params.userId);

        res.json({
          success: true,
          data: insights,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to fetch user analytics', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}
