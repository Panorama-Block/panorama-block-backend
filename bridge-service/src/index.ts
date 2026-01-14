// Bridge Service - Main entry point
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import { createServer } from 'http';

import { validateEnvironment } from './config/environment';
import { createDIContainer } from './infrastructure/di/container';
import { createHttpServer } from './infrastructure/http/server';
import { setupGracefulShutdown } from './infrastructure/utils/gracefulShutdown';
import { logger } from './infrastructure/utils/logger';

const PORT = process.env.PORT || 3005;

async function startBridgeService(): Promise<void> {
  try {
    logger.info('🚀 Starting Bridge Service with Hexagonal Architecture...');

    // Validate environment configuration
    const config = validateEnvironment();
    logger.info('✅ Environment configuration validated');

    // Create dependency injection container
    const container = await createDIContainer();
    logger.info('✅ Dependency injection container created');

    // Create HTTP server
    const app = express();
    const httpServer = createServer(app);

    // Setup HTTP routes and middleware
    await createHttpServer(app, container);
    logger.info('✅ HTTP server configured');

    // Start HTTP server
    const server = httpServer.listen(PORT, () => {
      logger.info(`🎉 Bridge Service HTTP server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      logger.info(`🏗️ Architecture: Hexagonal (Domain-Driven Design)`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔄 Bridge API: http://localhost:${PORT}/api/bridge`);

      logger.info('✨ Ready to process bridge operations!');
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server, container);

  } catch (error) {
    logger.error('💥 Failed to start Bridge Service:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Start the service
if (require.main === module) {
  startBridgeService();
}

export { startBridgeService };
