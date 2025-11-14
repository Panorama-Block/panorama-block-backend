import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DIContainer } from '../../di/container';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';

const ClaimRewardsSchema = z.object({
  balanceId: z.string().optional(),
  tokenSymbol: z.string().optional(),
  amount: z.string().optional()
}).refine(
  (data) => Boolean(data.balanceId || data.tokenSymbol),
  { message: 'balanceId or tokenSymbol is required' }
);

const SyncRequestSchema = z.object({
  force: z.boolean().optional(),
  chains: z.array(z.string()).optional(),
  protocols: z.array(z.string()).optional()
});

export function createTacBalanceRoutes(container: DIContainer): Router {
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

      if (!container.tacBalanceService) {
        throw new Error('TacBalanceService not available');
      }

      const balances = await container.tacBalanceService.getUserBalances(req.user.id);

      res.json({
        success: true,
        data: balances,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      requestLogger.error('Failed to fetch user balances', { error: error.message });
      next(error);
    }
  });

  router.get('/portfolio', async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
        });
      }

      if (!container.tacBalanceService) {
        throw new Error('TacBalanceService not available');
      }

      const summary = await container.tacBalanceService.getUserPortfolioSummary(req.user.id);

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      requestLogger.error('Failed to fetch portfolio summary', { error: error.message });
      next(error);
    }
  });

  router.post(
    '/sync',
    validationMiddleware(SyncRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
          });
        }

        if (!container.tacBalanceService) {
          throw new Error('TacBalanceService not available');
        }

        const { force = false, chains, protocols } = req.body;
        const result = await container.tacBalanceService.syncUserBalances(req.user.id, {
          force,
          chains,
          protocols
        });

        res.status(202).json({
          success: true,
          data: result,
          message: 'Balance synchronization scheduled',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to schedule balance sync', { error: error.message });
        next(error);
      }
    }
  );

  router.post(
    '/claim',
    validationMiddleware(ClaimRewardsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authenticated', traceId: req.traceId }
          });
        }

        if (!container.tacBalanceService) {
          throw new Error('TacBalanceService not available');
        }

        const { balanceId, tokenSymbol, amount } = req.body;
        const result = await container.tacBalanceService.claimRewards(req.user.id, {
          balanceId,
          tokenSymbol,
          amount
        });

        res.status(200).json({
          success: true,
          data: result,
          message: 'Rewards claim initiated',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        requestLogger.error('Failed to claim rewards', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}
