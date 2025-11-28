// TAC Service - Main entry point
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { validateEnvironment } from './config/environment';
import { createDIContainer } from './infrastructure/di/container';
import { createHttpServer } from './infrastructure/http/server';
import { createWebSocketServer } from './infrastructure/websocket/server';
import { setupGracefulShutdown } from './infrastructure/utils/gracefulShutdown';
import { logger } from './infrastructure/utils/logger';

const PORT = process.env.PORT || 3005;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 3006;

async function startTacService(): Promise<void> {
  try {
    logger.info('🚀 Starting TAC Service with Hexagonal Architecture...');

    // Validate environment configuration
    const config = validateEnvironment();
    logger.info('✅ Environment configuration validated');

    // Create dependency injection container
    const container = await createDIContainer();
    logger.info('✅ Dependency injection container created');

    // Database connection already established in DI container
    // (container.database.$connect invoked during creation)

    // Create HTTP server
    const app = express();
    const httpServer = createServer(app);

    // Setup CORS
    app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim())
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-ID', 'X-User-ID']
    }));

    // Setup HTTP routes and middleware
    await createHttpServer(app, container);
    logger.info('✅ HTTP server configured');

    // Setup WebSocket server if enabled
    let wsServer: SocketIOServer | null = null;
    if (config.ENABLE_WEBSOCKET) {
      wsServer = createWebSocketServer(httpServer, container);
      logger.info('✅ WebSocket server configured');
    }

    // Start HTTP server
    const server = httpServer.listen(PORT, () => {
      logger.info(`🎉 TAC Service HTTP server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      logger.info(`🏗️ Architecture: Hexagonal (Domain-Driven Design)`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📖 Documentation: http://localhost:${PORT}/docs`);
      logger.info(`🔄 TAC API: http://localhost:${PORT}/api/tac`);

      if (config.ENABLE_WEBSOCKET) {
        logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
      }

      logger.info('✨ Ready to process cross-chain operations!');
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server, container, wsServer);

    // Initialize background services
    await startBackgroundServices(container);
    logger.info('✅ Background services started');

  } catch (error) {
    logger.error('💥 Failed to start TAC Service:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

async function startBackgroundServices(container: any): Promise<void> {
  try {
    // Start operation monitoring service
    if (container.operationMonitor) {
      await container.operationMonitor.start();
      logger.info('✅ Operation monitoring service started');
    }

    // Start balance sync service
    if (container.balanceSyncService) {
      await container.balanceSyncService.start();
      logger.info('✅ Balance synchronization service started');
    }

    // Start analytics aggregation
    if (container.analyticsAggregator) {
      await container.analyticsAggregator.start();
      logger.info('✅ Analytics aggregation service started');
    }

    // Start notification processor
    if (container.notificationProcessor) {
      await container.notificationProcessor.start();
      logger.info('✅ Notification processor started');
    }

    // Start cleanup scheduler
    if (container.cleanupScheduler) {
      await container.cleanupScheduler.start();
      logger.info('✅ Data cleanup scheduler started');
    }

  } catch (error) {
    logger.error('Failed to start background services:', error);
    throw error;
  }
}

// Error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
if (require.main === module) {
  startTacService();
}

export { startTacService };
