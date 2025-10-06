import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticateToken } from '../../../middleware/auth.middleware';
import { asyncHandler } from '../../../utils/async-handler.utils';

export const createAnalyticsRoutes = (analyticsController: AnalyticsController): Router => {
  const router = Router();

  /**
   * @route GET /api/v1/analytics/market-overview
   * @desc Get market overview and statistics
   * @access Public
   * @query {number} [chainId=1] - Chain ID
   */
  router.get('/market-overview', asyncHandler(analyticsController.getMarketOverview.bind(analyticsController)));

  /**
   * @route GET /api/v1/analytics/apr-projections
   * @desc Get APR projections for a position
   * @access Public
   * @query {string} positionId - Position ID (required)
   * @query {number} chainId - Chain ID (required)
   */
  router.get('/apr-projections', asyncHandler(analyticsController.getAPRProjections.bind(analyticsController)));

  /**
   * @route GET /api/v1/analytics/compare-protocols
   * @desc Compare APR across different protocols for a token pair
   * @access Public
   * @query {string} token0 - Token0 address (required)
   * @query {string} token1 - Token1 address (required)
   * @query {number} chainId - Chain ID (required)
   */
  router.get('/compare-protocols', asyncHandler(analyticsController.compareProtocols.bind(analyticsController)));

  /**
   * @route GET /api/v1/analytics/historical-apr
   * @desc Get historical APR data for a position
   * @access Public
   * @query {string} positionId - Position ID (required)
   * @query {string} fromDate - Start date (ISO string)
   * @query {string} toDate - End date (ISO string)
   */
  router.get('/historical-apr', asyncHandler(analyticsController.getHistoricalAPR.bind(analyticsController)));

  // Protected routes (require authentication)

  /**
   * @route GET /api/v1/analytics/portfolio
   * @desc Get user portfolio statistics
   * @access Private
   * @query {number} [chainId] - Filter by chain ID
   */
  router.get('/portfolio', authenticateToken, asyncHandler(analyticsController.getUserPortfolioStats.bind(analyticsController)));

  return router;
};