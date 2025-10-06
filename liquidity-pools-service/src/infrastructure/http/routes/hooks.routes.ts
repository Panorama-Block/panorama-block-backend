import { Router } from 'express';
import { HooksController } from '../controllers/hooks.controller';
import { asyncHandler } from '../../../utils/async-handler.utils';

export const createHooksRoutes = (hooksController: HooksController): Router => {
  const router = Router();

  /**
   * @route GET /api/v1/hooks
   * @desc Get available hooks for V4 positions
   * @access Public
   * @query {number} chainId - Chain ID (required)
   * @query {string} [category] - Filter by hook category
   * @query {boolean} [verified] - Filter by verification status
   * @query {number} [limit=20] - Number of results per page
   * @query {number} [offset=0] - Page offset
   */
  router.get('/', asyncHandler(hooksController.getHooks.bind(hooksController)));

  /**
   * @route POST /api/v1/hooks/validate
   * @desc Validate a hook address and check safety
   * @access Public
   * @body {string} hookAddress - Hook contract address
   * @body {number} chainId - Chain ID
   * @body {string} [operation] - Specific operation to check (addLiquidity, removeLiquidity, swap, collect)
   */
  router.post('/validate', asyncHandler(hooksController.validateHook.bind(hooksController)));

  /**
   * @route GET /api/v1/hooks/categories
   * @desc Get available hook categories
   * @access Public
   * @query {number} chainId - Chain ID (required)
   */
  router.get('/categories', asyncHandler(hooksController.getHookCategories.bind(hooksController)));

  /**
   * @route GET /api/v1/hooks/:hookAddress
   * @desc Get specific hook details
   * @access Public
   * @param {string} hookAddress - Hook contract address
   * @query {number} chainId - Chain ID (required)
   */
  router.get('/:hookAddress', asyncHandler(hooksController.getHookById.bind(hooksController)));

  return router;
};