import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';
import { container } from './infrastructure/di/container';
import { TYPES } from './infrastructure/di/types';
import { setupRoutes, RouteControllers } from './infrastructure/http/routes';
import { errorHandler } from './middleware/error-handler.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { rateLimiter } from './middleware/rate-limiter.middleware';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3003;

// ========== Security & Performance Middleware ==========
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// ========== Request Processing Middleware ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== Application Middleware ==========
app.use(requestLogger);
app.use(rateLimiter);

// ========== Dependency Injection Setup ==========
const getControllers = (): RouteControllers => {
  return {
    positionsController: container.get(TYPES.PositionsController),
    poolsController: container.get(TYPES.PoolsController),
    hooksController: container.get(TYPES.HooksController),
    analyticsController: container.get(TYPES.AnalyticsController)
  };
};

// ========== Routes Setup ==========
setupRoutes(app, getControllers());

// ========== Error Handling ==========
app.use(errorHandler);

// ========== Server Startup ==========
const startServer = async () => {
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'JWT_SECRET',
      'UNISWAP_API_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingEnvVars);
      process.exit(1);
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('🚀 Liquidity Pools Service started successfully!');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API endpoints: http://localhost:${PORT}/api/v1/`);

      // Log available endpoints
      console.log('\n📋 Available endpoints:');
      console.log('  GET  /health                           - Health check');
      console.log('  GET  /api/v1/positions                 - Get user positions');
      console.log('  POST /api/v1/positions                 - Create position');
      console.log('  GET  /api/v1/pools                     - Get pools');
      console.log('  GET  /api/v1/hooks                     - Get hooks');
      console.log('  POST /api/v1/hooks/validate            - Validate hook');
      console.log('  GET  /api/v1/analytics/market-overview - Market overview');
      console.log('  GET  /api/v1/analytics/portfolio       - User portfolio (auth required)');
      console.log('');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }

        console.log('✅ Server closed successfully');
        console.log('👋 Liquidity Pools Service stopped');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();