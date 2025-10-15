import { Router, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { SmartAccountService } from '../services/smartAccount.service';
import { DCAService } from '../services/dca.service';
import { CreateSmartAccountRequest, CreateStrategyRequest } from '../types';

export function dcaRoutes(redisClient: RedisClientType) {
  const router = Router();
  const smartAccountService = new SmartAccountService(redisClient);
  const dcaService = new DCAService(redisClient);

  // ==================== SMART ACCOUNTS ====================

  /**
   * POST /dca/create-account
   * Create a new smart account with session keys
   */
  router.post('/create-account', async (req: Request, res: Response) => {
    try {
      console.log('[POST /create-account] Request received');

      const request: CreateSmartAccountRequest = req.body;

      if (!request.userId || !request.name || !request.permissions) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await smartAccountService.createSmartAccount(request);

      console.log('[POST /create-account] ✅ Account created successfully');
      res.json(result);
    } catch (error: any) {
      console.error('[POST /create-account] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/accounts/:userId
   * Get all smart accounts for a user
   */
  router.get('/accounts/:userId', async (req: Request, res: Response) => {
    try {
      console.log('[GET /accounts/:userId] Request for user:', req.params.userId);

      const accounts = await smartAccountService.getUserAccounts(req.params.userId);

      res.json({ accounts });
    } catch (error: any) {
      console.error('[GET /accounts/:userId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/account/:address
   * Get single smart account details
   */
  router.get('/account/:address', async (req: Request, res: Response) => {
    try {
      const account = await smartAccountService.getSmartAccount(req.params.address);

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json(account);
    } catch (error: any) {
      console.error('[GET /account/:address] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /dca/account/:address
   * Delete a smart account
   */
  router.delete('/account/:address', async (req: Request, res: Response) => {
    try {
      console.log('[DELETE /account/:address] Deleting account:', req.params.address);

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      await smartAccountService.deleteSmartAccount(req.params.address, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE /account/:address] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DCA STRATEGIES ====================

  /**
   * POST /dca/create-strategy
   * Create a new DCA strategy
   */
  router.post('/create-strategy', async (req: Request, res: Response) => {
    try {
      console.log('[POST /create-strategy] Request received');

      const request: CreateStrategyRequest = req.body;

      if (!request.smartAccountId || !request.fromToken || !request.toToken || !request.amount || !request.interval) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await dcaService.createStrategy(request);

      console.log('[POST /create-strategy] ✅ Strategy created successfully');
      res.json(result);
    } catch (error: any) {
      console.error('[POST /create-strategy] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/strategies/:smartAccountId
   * Get all strategies for a smart account
   */
  router.get('/strategies/:smartAccountId', async (req: Request, res: Response) => {
    try {
      const strategies = await dcaService.getAccountStrategies(req.params.smartAccountId);

      res.json({ strategies });
    } catch (error: any) {
      console.error('[GET /strategies/:smartAccountId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /dca/strategy/:strategyId/toggle
   * Activate or deactivate a strategy
   */
  router.patch('/strategy/:strategyId/toggle', async (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      await dcaService.toggleStrategy(req.params.strategyId, isActive);

      res.json({ success: true, isActive });
    } catch (error: any) {
      console.error('[PATCH /strategy/:strategyId/toggle] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /dca/strategy/:strategyId
   * Delete a strategy
   */
  router.delete('/strategy/:strategyId', async (req: Request, res: Response) => {
    try {
      await dcaService.deleteStrategy(req.params.strategyId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE /strategy/:strategyId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/history/:smartAccountId
   * Get execution history for a smart account
   */
  router.get('/history/:smartAccountId', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await dcaService.getExecutionHistory(req.params.smartAccountId, limit);

      res.json({ history });
    } catch (error: any) {
      console.error('[GET /history/:smartAccountId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
