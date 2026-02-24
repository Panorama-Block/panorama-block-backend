import dotenv from 'dotenv';
import { Logger } from './infrastructure/logs/logger';
import { DatabaseService } from './infrastructure/database/database.service';
import { createApp } from './app';

// Load environment variables
dotenv.config();

const app = createApp();
const port = process.env.PORT || 3004;
const logger = new Logger();

export async function bootstrap() {
  if (DatabaseService.isConfigured()) {
    try {
      logger.info('🗄️  Database configured, initializing...');
      const db = DatabaseService.getInstance();
      const ok = await db.checkConnection();
      if (ok) {
        await db.initializeSchema();
        logger.info('🗄️  Database ready');
      } else {
        logger.warn('🗄️  Database configured but connection check failed (service will run without persistence)');
      }
    } catch (error) {
      logger.error(`🗄️  Database initialization failed (service will run without persistence): ${error}`);
    }
  } else {
    logger.warn('🗄️  DATABASE_URL not set; persistence disabled');
  }

  // Start server
  app.listen(port, () => {
    logger.info(`🚀 Lido Service running on port ${port}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(
      `🔐 Authentication: Centralized (auth-service at ${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'})`
    );
    logger.info('📋 Available endpoints:');
    logger.info('  - GET  /health');
    logger.info('  - GET  /');
    logger.info('  - POST /api/lido/stake (requires JWT)');
    logger.info('  - POST /api/lido/unstake (requires JWT)');
    logger.info('  - POST /api/lido/claim-rewards (requires JWT)');
    logger.info('  - GET  /api/lido/position/:userAddress (optional JWT)');
    logger.info('  - GET  /api/lido/history/:userAddress (optional JWT)');
    logger.info('  - GET  /api/lido/protocol/info (public)');
    logger.info('  - GET  /api/lido/transaction/:txHash (public)');
    logger.info('');
    logger.info('🔑 To authenticate:');
    logger.info('  1. POST to auth-service/auth/login to get SIWE payload');
    logger.info('  2. Sign payload with wallet');
    logger.info('  3. POST to auth-service/auth/verify with signature to get JWT');
      logger.info('  4. Use JWT in Authorization header: Bearer <token>');
  });
}

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error(`Fatal bootstrap error: ${err}`);
    process.exit(1);
  });
}

export default app;
