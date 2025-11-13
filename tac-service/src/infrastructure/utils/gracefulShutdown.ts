// Graceful Shutdown Utilities
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { DIContainer } from '../di/container';
import { logger } from './logger';

interface ShutdownOptions {
  timeout?: number; // Timeout in milliseconds (default: 30000)
  signals?: string[]; // Signals to handle (default: ['SIGTERM', 'SIGINT', 'SIGUSR2'])
}

export function setupGracefulShutdown(
  httpServer: Server,
  container: DIContainer,
  wsServer?: SocketIOServer,
  options: ShutdownOptions = {}
): void {
  const timeout = options.timeout || 30000; // 30 seconds default
  const signals = options.signals || ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`🔄 Shutdown already in progress, ignoring ${signal}`);
      return;
    }

    isShuttingDown = true;
    logger.info(`🛑 Received ${signal}. Graceful shutdown starting...`);

    const shutdownTimeout = setTimeout(() => {
      logger.error('⚠️ Forceful shutdown due to timeout');
      process.exit(1);
    }, timeout);

    try {
      // Phase 1: Stop accepting new connections
      httpServer.close(() => {
        logger.info('🔒 HTTP server stopped accepting new connections');
      });

      // Phase 2: Close WebSocket server
      if (wsServer) {
        await new Promise<void>((resolve) => {
          wsServer.close(() => {
            logger.info('🔌 WebSocket server closed');
            resolve();
          });
        });
      }

      // Phase 3: Stop background services gracefully
      await stopBackgroundServices(container);

      // Phase 4: Close database connections
      await container.database.$disconnect();
      logger.info('🗃️ Database connections closed');

      // Phase 5: Cleanup complete
      clearTimeout(shutdownTimeout);
      logger.info('✅ Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  signals.forEach(signal => {
    process.on(signal, () => shutdown(signal));
  });

  logger.info(`🛡️ Graceful shutdown handlers registered for signals: ${signals.join(', ')}`);
}

async function stopBackgroundServices(container: DIContainer): Promise<void> {
  const services = [
    { name: 'Operation Monitor', service: container.operationMonitor },
    { name: 'Analytics Aggregator', service: container.analyticsAggregator },
    { name: 'Notification Processor', service: container.notificationProcessor },
    { name: 'Cleanup Scheduler', service: container.cleanupScheduler }
  ];

  const stopPromises = services.map(async ({ name, service }) => {
    if (service && typeof service.stop === 'function') {
      try {
        await service.stop();
        logger.info(`✅ ${name} stopped successfully`);
      } catch (error) {
        logger.error(`❌ Error stopping ${name}:`, error);
        throw error;
      }
    }
  });

  await Promise.all(stopPromises);
  logger.info('🔄 All background services stopped');
}

// Health check for shutdown status
export function isShuttingDown(): boolean {
  return process.exitCode !== undefined;
}

// Force shutdown utility (use with caution)
export function forceShutdown(exitCode: number = 1): void {
  logger.error('💥 Force shutdown initiated');
  process.exit(exitCode);
}

// Process error handlers
export function setupProcessErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    forceShutdown(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    forceShutdown(1);
  });

  // Handle specific Node.js warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      logger.warn('⚠️ MaxListenersExceededWarning:', warning.message);
    } else {
      logger.warn('⚠️ Node.js Warning:', warning);
    }
  });

  logger.info('🛡️ Process error handlers configured');
}