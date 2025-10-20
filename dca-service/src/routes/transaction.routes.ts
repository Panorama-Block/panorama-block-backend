/**
 * Transaction Routes
 * Secure endpoints for signing transactions with session keys
 */

import { Router, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { TransactionService } from '../services/transaction.service';
import { SmartAccountService } from '../services/smartAccount.service';

export function createTransactionRoutes(redisClient: RedisClientType): Router {
  const router = Router();
  const smartAccountService = new SmartAccountService(redisClient);
  const transactionService = new TransactionService(
    redisClient,
    smartAccountService
  );

  /**
   * POST /transaction/sign-and-execute
   * Sign and execute a transaction using session key (SECURE!)
   *
   * Body:
   * {
   *   "smartAccountAddress": "0x...",
   *   "userId": "0x...",
   *   "to": "0x...",
   *   "value": "0.01",
   *   "chainId": 1
   * }
   */
  router.post('/sign-and-execute', async (req: Request, res: Response) => {
    console.log('[POST /transaction/sign-and-execute] Request received');

    try {
      const { smartAccountAddress, userId, to, value, chainId, data } =
        req.body;

      // Validate required fields
      if (!smartAccountAddress || !userId || !to || !value || !chainId) {
        return res.status(400).json({
          error:
            'Missing required fields: smartAccountAddress, userId, to, value, chainId',
        });
      }

      // Execute transaction (private key NEVER leaves backend!)
      const result = await transactionService.signAndExecuteTransaction({
        smartAccountAddress,
        userId,
        to,
        value,
        chainId,
        data,
      });

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Transaction failed',
        });
      }

      res.json({
        transactionHash: result.transactionHash,
        success: true,
      });
    } catch (error: any) {
      console.error('[POST /transaction/sign-and-execute] Error:', error);
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  });

  /**
   * POST /transaction/validate
   * Validate if a transaction would be allowed by session key permissions
   *
   * Body:
   * {
   *   "smartAccountAddress": "0x...",
   *   "to": "0x...",
   *   "value": "0.01"
   * }
   */
  router.post('/validate', async (req: Request, res: Response) => {
    console.log('[POST /transaction/validate] Validating permissions');

    try {
      const { smartAccountAddress, to, value } = req.body;

      if (!smartAccountAddress || !to || !value) {
        return res.status(400).json({
          error: 'Missing required fields: smartAccountAddress, to, value',
        });
      }

      const validation = await transactionService.validateSessionPermissions(
        smartAccountAddress,
        to,
        value
      );

      res.json(validation);
    } catch (error: any) {
      console.error('[POST /transaction/validate] Error:', error);
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  });

  return router;
}
