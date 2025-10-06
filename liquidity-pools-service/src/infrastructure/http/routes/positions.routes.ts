import { Router } from 'express';
import { PositionsController } from '../controllers/positions.controller';
import { authenticateToken } from '../../../middleware/auth.middleware';
import { asyncHandler } from '../../../utils/async-handler.utils';

export const createPositionsRoutes = (positionsController: PositionsController): Router => {
  const router = Router();

  // All position routes require authentication
  router.use(authenticateToken);

  /**
   * @route GET /api/v1/positions
   * @desc Get user's liquidity positions
   * @access Private
   * @query {number} [chainId] - Filter by chain ID
   * @query {boolean} [includeInactive] - Include positions with 0 liquidity
   * @query {string} [protocol] - Filter by protocol (v2, v3, v4)
   */
  router.get('/', asyncHandler(positionsController.getPositions.bind(positionsController)));

  /**
   * @route POST /api/v1/positions
   * @desc Create a new liquidity position
   * @access Private
   * @body {object} position - Position creation parameters
   */
  router.post('/', asyncHandler(positionsController.createPosition.bind(positionsController)));

  /**
   * @route GET /api/v1/positions/:positionId
   * @desc Get specific position details
   * @access Private
   * @param {string} positionId - Position ID
   */
  router.get('/:positionId', asyncHandler(positionsController.getPositionById.bind(positionsController)));

  /**
   * @route POST /api/v1/positions/:positionId/increase
   * @desc Increase liquidity in existing position
   * @access Private
   * @param {string} positionId - Position ID
   */
  router.post('/:positionId/increase', asyncHandler(positionsController.increasePosition.bind(positionsController)));

  /**
   * @route POST /api/v1/positions/:positionId/decrease
   * @desc Decrease liquidity in existing position
   * @access Private
   * @param {string} positionId - Position ID
   */
  router.post('/:positionId/decrease', asyncHandler(positionsController.decreasePosition.bind(positionsController)));

  /**
   * @route POST /api/v1/positions/:positionId/collect
   * @desc Collect fees from position
   * @access Private
   * @param {string} positionId - Position ID
   */
  router.post('/:positionId/collect', asyncHandler(positionsController.collectFees.bind(positionsController)));

  return router;
};