import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DIContainer } from '../../di/container';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';

const UpdateConfigurationSchema = z.object({
  preferredChains: z.array(z.string()).max(10).optional(),
  preferredProtocols: z.array(z.string()).max(10).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  autoRouteSelection: z.boolean().optional(),
  notifications: z.object({
    operationUpdates: z.boolean().optional(),
    rewards: z.boolean().optional(),
    systemAlerts: z.boolean().optional()
  }).optional()
});

const UpdateNotificationSchema = z.object({
  channel: z.enum(['websocket', 'push', 'telegram', 'email', 'sms']),
  enabled: z.boolean(),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().optional()
  }).optional()
});

export function createTacConfigurationRoutes(container: DIContainer): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
        });
      }

      if (!container.tacConfigurationService) {
        throw new Error('TacConfigurationService not available');
      }

      const configuration = await container.tacConfigurationService.getUserConfiguration(req.user.id);

      res.json({
        success: true,
        data: configuration,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      requestLogger.error('Failed to fetch TAC configuration', { error: error.message });
      next(error);
    }
  });

  router.patch(
    '/',
    validationMiddleware(UpdateConfigurationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
          });
        }

        if (!container.tacConfigurationService) {
          throw new Error('TacConfigurationService not available');
        }

        const updated = await container.tacConfigurationService.updateUserConfiguration(
          req.user.id,
          req.body
        );

        res.json({
          success: true,
          data: updated,
          message: 'Configuration updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to update TAC configuration', { error: error.message });
        next(error);
      }
    }
  );

  router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
        });
      }

      if (!container.notificationService) {
        throw new Error('NotificationService not available');
      }

      const preferences = await container.notificationService.getUserPreferences(req.user.id);

      res.json({
        success: true,
        data: preferences,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      requestLogger.error('Failed to fetch notification preferences', { error: error.message });
      next(error);
    }
  });

  router.patch(
    '/notifications',
    validationMiddleware(UpdateNotificationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
          });
        }

        if (!container.notificationService) {
          throw new Error('NotificationService not available');
        }

        const current = await container.notificationService.getUserPreferences(req.user.id);
        const updatedChannels = {
          ...current.channels,
          [req.body.channel]: req.body.enabled
        };

        await container.notificationService.updateUserPreferences(req.user.id, {
          channels: updatedChannels,
          quiet_hours: req.body.quietHours
        });

        res.json({
          success: true,
          message: 'Notification preferences updated',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to update notification preferences', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}
