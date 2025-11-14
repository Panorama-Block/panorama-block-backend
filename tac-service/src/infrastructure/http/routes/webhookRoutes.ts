import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { DIContainer } from '../../di/container';
import { createRequestLogger } from '../../utils/logger';

function verifySignature(payload: Buffer | undefined, secret: string, signature?: string): boolean {
  if (!payload || !secret || !signature) return false;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export function createWebhookRoutes(container: DIContainer): Router {
  const router = Router();

  router.post(
    '/tac',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        const signature = Array.isArray(req.headers['x-tac-signature'])
          ? req.headers['x-tac-signature'][0]
          : req.headers['x-tac-signature'];

        if (!verifySignature(req.rawBody, container.config.TAC_WEBHOOK_SECRET, signature)) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' }
          });
        }

        if (!container.tacEventService) {
          throw new Error('TacEventService not available');
        }

        await container.tacEventService.handleWebhookEvent(req.body);

        res.status(202).json({ success: true });
      } catch (error: any) {
        requestLogger.error('Webhook processing failed', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}
