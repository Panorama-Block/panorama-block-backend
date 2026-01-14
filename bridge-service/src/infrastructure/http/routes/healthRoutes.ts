// Health Check Routes - System health monitoring endpoints
import { Router, Request, Response } from 'express';
import { DIContainer } from '../../di/container';
import { logger, logHealthCheck } from '../../utils/logger';

export function createHealthRoutes(container: DIContainer): Router {
  const router = Router();

  // GET /health - Basic health check
  router.get('/', async (req: Request, res: Response) => {
    try {
      const healthStatus = {
        service: 'Bridge Service',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: container.config.NODE_ENV,
        architecture: 'Hexagonal (Domain-Driven Design)'
      };

      logHealthCheck('basic-health', 'healthy', healthStatus);

      res.status(200).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed:', error);

      const errorStatus = {
        service: 'Bridge Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as any).message
      };

      logHealthCheck('basic-health', 'unhealthy', { error: (error as any).message });

      res.status(503).json(errorStatus);
    }
  });

  // GET /health/detailed - Detailed health check with all components
  router.get('/detailed', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Check database connectivity
      const dbHealth = await checkDatabaseHealth(container);

      // Overall system health
      const allComponentsHealthy = [
        dbHealth.healthy
      ].every(status => status === true);

      const statusString = allComponentsHealthy ? 'healthy' : 'unhealthy'; // Changed 'degraded' to 'unhealthy' to match type

      const healthReport = {
        service: 'Bridge Service',
        version: '1.0.0',
        status: statusString,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: Date.now() - startTime,
        environment: container.config.NODE_ENV,
        architecture: 'Hexagonal (Domain-Driven Design)',
        components: {
          database: dbHealth
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };

      logHealthCheck('detailed-health', statusString, {
        components: Object.keys(healthReport.components).map(key => ({
          name: key,
          status: healthReport.components[key as keyof typeof healthReport.components].healthy ? 'healthy' : 'unhealthy'
        }))
      });

      res.status(allComponentsHealthy ? 200 : 503).json(healthReport);

    } catch (error) {
      logger.error('Detailed health check failed:', error);

      const errorReport = {
        service: 'Bridge Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: (error as any).message,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };

      logHealthCheck('detailed-health', 'unhealthy', { error: (error as any).message });

      res.status(503).json(errorReport);
    }
  });

  return router;
}

// Helper functions for health checks
async function checkDatabaseHealth(container: DIContainer): Promise<{ healthy: boolean; message: string; responseTime?: number }> {
  const startTime = Date.now();

  try {
    // Simple database ping
    await container.database.$queryRaw`SELECT 1`;

    return {
      healthy: true,
      message: 'Database connection is healthy',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    logger.error('Database health check failed:', error);

    return {
      healthy: false,
      message: `Database connection failed: ${(error as any).message}`,
      responseTime: Date.now() - startTime
    };
  }
}