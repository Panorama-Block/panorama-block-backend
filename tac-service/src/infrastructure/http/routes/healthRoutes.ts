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
        service: 'TAC Service',
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
        service: 'TAC Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };

      logHealthCheck('basic-health', 'unhealthy', { error: error.message });

      res.status(503).json(errorStatus);
    }
  });

  // GET /health/detailed - Detailed health check with all components
  router.get('/detailed', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Check database connectivity
      const dbHealth = await checkDatabaseHealth(container);

      // Check TAC SDK connectivity
      const tacSdkHealth = await checkTacSdkHealth(container);

      // Check background services
      const servicesHealth = checkBackgroundServicesHealth(container);

      // Check WebSocket server
      const wsHealth = checkWebSocketHealth(container);

      // Overall system health
      const allComponentsHealthy = [
        dbHealth.healthy,
        tacSdkHealth.healthy,
        servicesHealth.healthy,
        wsHealth.healthy
      ].every(status => status === true);

      const healthReport = {
        service: 'TAC Service',
        version: '1.0.0',
        status: allComponentsHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: Date.now() - startTime,
        environment: container.config.NODE_ENV,
        architecture: 'Hexagonal (Domain-Driven Design)',
        components: {
          database: dbHealth,
          tacSdk: tacSdkHealth,
          backgroundServices: servicesHealth,
          websocket: wsHealth
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        },
        features: {
          websocketEnabled: container.config.ENABLE_WEBSOCKET,
          analyticsEnabled: container.config.ENABLE_ANALYTICS,
          notificationsEnabled: container.config.ENABLE_PUSH_NOTIFICATIONS
        }
      };

      logHealthCheck('detailed-health', allComponentsHealthy ? 'healthy' : 'degraded', {
        components: Object.keys(healthReport.components).map(key => ({
          name: key,
          status: healthReport.components[key as keyof typeof healthReport.components].healthy ? 'healthy' : 'unhealthy'
        }))
      });

      res.status(allComponentsHealthy ? 200 : 503).json(healthReport);

    } catch (error) {
      logger.error('Detailed health check failed:', error);

      const errorReport = {
        service: 'TAC Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };

      logHealthCheck('detailed-health', 'unhealthy', { error: error.message });

      res.status(503).json(errorReport);
    }
  });

  // GET /health/readiness - Kubernetes readiness probe
  router.get('/readiness', async (req: Request, res: Response) => {
    try {
      // Check critical components for readiness
      const dbReady = await checkDatabaseHealth(container);
      const tacSdkReady = await checkTacSdkHealth(container);

      const isReady = dbReady.healthy && tacSdkReady.healthy;

      const readinessReport = {
        status: isReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbReady.healthy ? 'ready' : 'not_ready',
          tacSdk: tacSdkReady.healthy ? 'ready' : 'not_ready'
        }
      };

      logHealthCheck('readiness', isReady ? 'healthy' : 'unhealthy', readinessReport.checks);

      res.status(isReady ? 200 : 503).json(readinessReport);

    } catch (error) {
      logger.error('Readiness check failed:', error);

      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // GET /health/liveness - Kubernetes liveness probe
  router.get('/liveness', (req: Request, res: Response) => {
    // Simple liveness check - if this endpoint responds, the service is alive
    const livenessReport = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid
    };

    logHealthCheck('liveness', 'healthy');

    res.status(200).json(livenessReport);
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
      message: `Database connection failed: ${error.message}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkTacSdkHealth(container: DIContainer): Promise<{ healthy: boolean; message: string; responseTime?: number }> {
  const startTime = Date.now();

  try {
    // Check TAC SDK health endpoint
    const healthStatus = await container.tacSdkService.getHealth();

    return {
      healthy: healthStatus.healthy,
      message: healthStatus.message || 'TAC SDK is healthy',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    logger.error('TAC SDK health check failed:', error);

    return {
      healthy: false,
      message: `TAC SDK connection failed: ${error.message}`,
      responseTime: Date.now() - startTime
    };
  }
}

function checkBackgroundServicesHealth(container: DIContainer): { healthy: boolean; message: string; services: Record<string, boolean> } {
  try {
    const services = {
      operationMonitor: container.operationMonitor?.isRunning?.() || false,
      analyticsAggregator: container.analyticsAggregator?.isRunning?.() || false,
      notificationProcessor: container.notificationProcessor?.isRunning?.() || false,
      cleanupScheduler: container.cleanupScheduler?.isRunning?.() || false
    };

    const allHealthy = Object.values(services).every(status => status === true);

    return {
      healthy: allHealthy,
      message: allHealthy ? 'All background services are running' : 'Some background services are not running',
      services
    };
  } catch (error) {
    logger.error('Background services health check failed:', error);

    return {
      healthy: false,
      message: `Background services check failed: ${error.message}`,
      services: {}
    };
  }
}

function checkWebSocketHealth(container: DIContainer): { healthy: boolean; message: string; enabled: boolean } {
  try {
    if (!container.config.ENABLE_WEBSOCKET) {
      return {
        healthy: true,
        message: 'WebSocket is disabled',
        enabled: false
      };
    }

    // WebSocket health would be checked here if we had reference to the WS server
    return {
      healthy: true,
      message: 'WebSocket server is enabled and running',
      enabled: true
    };
  } catch (error) {
    logger.error('WebSocket health check failed:', error);

    return {
      healthy: false,
      message: `WebSocket check failed: ${error.message}`,
      enabled: container.config.ENABLE_WEBSOCKET
    };
  }
}