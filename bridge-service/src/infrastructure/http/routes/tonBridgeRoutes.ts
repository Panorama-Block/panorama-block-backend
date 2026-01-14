import { Router } from 'express';
import { DIContainer } from '../../di/container';

export function createTonBridgeRoutes(container: DIContainer): Router {
  const router = Router();
  const { bridgeController } = container;

  /**
   * POST /bridge/quote
   * Get a quote for a bridge transaction
   */
  router.post('/quote', (req, res, next) => bridgeController.getBridgeQuote(req, res, next));

  /**
   * POST /bridge/transaction
   * Create a bridge transaction (Layerswap)
   */
  router.post('/transaction', (req, res, next) => bridgeController.createBridgeTransaction(req, res, next));

  /**
   * GET /bridge/transaction/:swapId
   * Get status for a specific bridge swap
   */
  router.get('/transaction/:swapId', (req, res, next) => bridgeController.getBridgeStatus(req, res, next));

  return router;
}
