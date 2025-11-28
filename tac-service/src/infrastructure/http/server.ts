// TAC Service HTTP Server Configuration
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

import { DIContainer } from '../di/container';
import { getSecurityConfig } from '../../config/environment';
import { logger } from '../utils/logger';

// Route handlers
import { createTacOperationRoutes } from '../http/routes/tacOperationRoutes';
import { createTacQuoteRoutes } from '../http/routes/tacQuoteRoutes';
import { createTacBalanceRoutes } from '../http/routes/tacBalanceRoutes';
import { createTacConfigurationRoutes } from '../http/routes/tacConfigurationRoutes';
import { createTacAnalyticsRoutes } from '../http/routes/tacAnalyticsRoutes';
import { createHealthRoutes } from '../http/routes/healthRoutes';
import { createWebhookRoutes } from '../http/routes/webhookRoutes';
import { createDocsRoutes } from '../http/routes/docsRoutes';
import { createAuthLinkRoutes } from '../http/routes/authLinkRoutes';
import { createTonSwapRoutes } from '../http/routes/tonSwapRoutes';

// Middleware
import { authenticationMiddleware } from '../http/middleware/authenticationMiddleware';
import { authorizationMiddleware } from '../http/middleware/authorizationMiddleware';
import { validationMiddleware } from '../http/middleware/validationMiddleware';
import { errorHandlingMiddleware } from '../http/middleware/errorHandlingMiddleware';
import { loggingMiddleware } from '../http/middleware/loggingMiddleware';
import { tracingMiddleware } from '../http/middleware/tracingMiddleware';

export async function createHttpServer(app: Application, container: DIContainer): Promise<void> {
  const securityConfig = getSecurityConfig();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // Compression middleware
  app.use(compression());

  // Request parsing middleware
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, res, buf) => {
      // Store raw body for webhook signature verification
      if (req.originalUrl && req.originalUrl.includes('/webhook')) {
        req.rawBody = buf;
      }
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const rateLimitConfig = rateLimit({
    windowMs: securityConfig.rateLimit.windowMs,
    max: securityConfig.rateLimit.maxRequests,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(securityConfig.rateLimit.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      // Use user ID if authenticated, otherwise use IP
      const userId = (req as any).user?.id;
      return userId || req.ip || 'unknown';
    },
    skip: (req: Request): boolean => {
      // Skip rate limiting for health checks and webhooks
      return req.path === '/health' || req.path.startsWith('/webhook');
    }
  });

  app.use(rateLimitConfig);

  // Request tracing and logging
  app.use(tracingMiddleware);
  app.use(loggingMiddleware);

  // Health check route (no authentication required)
  app.use('/health', createHealthRoutes(container));

  // Documentation routes (no authentication required)
  app.use('/docs', createDocsRoutes());

  // Webhook routes (special authentication)
  app.use('/webhook', createWebhookRoutes(container));

  // Public auth/linking routes (TonConnect, EVM wallet registration)
  app.use('/auth', createAuthLinkRoutes(container));

  // Authentication middleware for protected routes
  app.use('/api', authenticationMiddleware(securityConfig.jwt));

  // Protected API routes
  app.use('/api/tac/operations', authorizationMiddleware(['user', 'admin']), createTacOperationRoutes(container));
  app.use('/api/tac/quotes', authorizationMiddleware(['user', 'admin']), createTacQuoteRoutes(container));
  app.use('/api/tac/ton-swap', authorizationMiddleware(['user', 'admin']), createTonSwapRoutes(container));
  app.use('/api/tac/balances', authorizationMiddleware(['user', 'admin']), createTacBalanceRoutes(container));
  app.use('/api/tac/configuration', authorizationMiddleware(['user', 'admin']), createTacConfigurationRoutes(container));
  app.use('/api/tac/analytics', authorizationMiddleware(['admin']), createTacAnalyticsRoutes(container));

  // API root endpoint
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      service: 'TAC Service',
      version: '1.0.0',
      architecture: 'Hexagonal (Domain-Driven Design)',
      documentation: '/docs',
      health: '/health',
      endpoints: {
        operations: '/api/tac/operations',
        quotes: '/api/tac/quotes',
        balances: '/api/tac/balances',
        configuration: '/api/tac/configuration',
        analytics: '/api/tac/analytics'
      },
      websocket: container.config.ENABLE_WEBSOCKET ? '/ws' : null,
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'ENDPOINT_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
      timestamp: new Date().toISOString(),
      traceId: (req as any).traceId
    });
  });

  // Global error handling middleware
  app.use(errorHandlingMiddleware);

  logger.info('✅ HTTP server configured with all routes and middleware');
}

// Graceful shutdown helper
export function setupGracefulShutdown(
  server: any,
  container: DIContainer,
  wsServer?: any
): void {
  const shutdown = async (signal: string) => {
    logger.info(`🛑 Received ${signal}. Graceful shutdown starting...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('🔒 HTTP server stopped accepting new connections');

      try {
        // Close WebSocket server
        if (wsServer) {
          wsServer.close(() => {
            logger.info('🔌 WebSocket server closed');
          });
        }

        // Stop background services and close database
        await container.operationMonitor?.stop?.();
        await container.analyticsAggregator?.stop?.();
        await container.notificationProcessor?.stop?.();
        await container.cleanupScheduler?.stop?.();
        await container.database.$disconnect();

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force close after timeout
    setTimeout(() => {
      logger.error('⚠️ Forceful shutdown due to timeout');
      process.exit(1);
    }, 30000); // 30 seconds timeout
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

// Request interface extension for custom properties
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      user?: {
        id: string;
        role: string;
        [key: string]: any;
      };
      rawBody?: Buffer;
    }
  }
}
