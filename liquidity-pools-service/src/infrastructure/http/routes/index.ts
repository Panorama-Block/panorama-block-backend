import { Express } from 'express';
import { PositionsController } from '../controllers/positions.controller';
import { PoolsController } from '../controllers/pools.controller';
import { HooksController } from '../controllers/hooks.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { createPositionsRoutes } from './positions.routes';
import { createPoolsRoutes } from './pools.routes';
import { createHooksRoutes } from './hooks.routes';
import { createAnalyticsRoutes } from './analytics.routes';

export interface RouteControllers {
  positionsController: PositionsController;
  poolsController: PoolsController;
  hooksController: HooksController;
  analyticsController: AnalyticsController;
}

export const setupRoutes = (app: Express, controllers: RouteControllers): void => {
  const apiPrefix = '/api/v1';

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'liquidity-pools-service',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // API routes
  app.use(`${apiPrefix}/positions`, createPositionsRoutes(controllers.positionsController));
  app.use(`${apiPrefix}/pools`, createPoolsRoutes(controllers.poolsController));
  app.use(`${apiPrefix}/hooks`, createHooksRoutes(controllers.hooksController));
  app.use(`${apiPrefix}/analytics`, createAnalyticsRoutes(controllers.analyticsController));

  // 404 handler for unmatched routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist`
    });
  });
};