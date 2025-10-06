import { Router } from 'express';
import { PoolsController } from '../controllers/pools.controller';
import { asyncHandler } from '../../../utils/async-handler.utils';

export const createPoolsRoutes = (poolsController: PoolsController): Router => {
  const router = Router();

  /**
   * @route GET /api/v1/pools
   * @desc Get available liquidity pools
   * @access Public
   * @query {number} chainId - Chain ID (required)
   * @query {string} [protocol] - Filter by protocol (v2, v3, v4)
   * @query {string} [token0] - Filter by token0 address
   * @query {string} [token1] - Filter by token1 address
   * @query {number} [feeTier] - Filter by fee tier
   * @query {number} [limit=20] - Number of results per page
   * @query {number} [offset=0] - Page offset
   */
  router.get('/', asyncHandler(poolsController.getPools.bind(poolsController)));

  /**
   * @route GET /api/v1/pools/search
   * @desc Search pools by criteria
   * @access Public
   * @query {number} chainId - Chain ID (required)
   * @query {string} [q] - Search query
   * @query {string} [protocol] - Filter by protocol
   * @query {number} [minTVL] - Minimum TVL filter
   * @query {number} [minVolume] - Minimum 24h volume filter
   */
  router.get('/search', asyncHandler(poolsController.searchPools.bind(poolsController)));

  /**
   * @route GET /api/v1/pools/:poolId
   * @desc Get specific pool details
   * @access Public
   * @param {string} poolId - Pool address
   * @query {number} chainId - Chain ID (required)
   */
  router.get('/:poolId', asyncHandler(poolsController.getPoolById.bind(poolsController)));

  /**
   * @route GET /api/v1/pools/:poolId/stats
   * @desc Get pool statistics and metrics
   * @access Public
   * @param {string} poolId - Pool address
   * @query {number} chainId - Chain ID (required)
   * @query {string} [period=24h] - Time period (1h, 24h, 7d, 30d)
   */
  router.get('/:poolId/stats', asyncHandler(poolsController.getPoolStats.bind(poolsController)));

  return router;
};