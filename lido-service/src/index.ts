import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LidoRoutes } from './infrastructure/http/routes/lidoRoutes';
import { ErrorHandler } from './infrastructure/http/middleware/errorHandler';
import { Logger } from './infrastructure/logs/logger';
import { DatabaseService } from './infrastructure/database/database.service';
import { EthereumConfig } from './infrastructure/config/ethereum';
import { ERROR_CODES, sendError } from './shared/errorCodes';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3004;
const logger = new Logger();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Per-account rate limiter
const RL_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const RL_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const rlBuckets = new Map<string, number[]>();

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip read-only/health endpoints
  const path = req.path || '';
  if (path === '/health' || path === '/' || req.method === 'OPTIONS') return next();

  // Key by wallet address (from JWT payload on req.user set by auth middleware)
  // or body address, falling back to IP
  const key = (req as any).user?.address?.toLowerCase()
    || req.body?.userAddress?.toLowerCase()
    || req.ip
    || 'unknown';

  const now = Date.now();
  const windowStart = now - RL_WINDOW_MS;
  const timestamps = (rlBuckets.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= RL_MAX) {
    sendError(res, 429, ERROR_CODES.RATE_LIMITED,
      `Rate limit exceeded. Max ${RL_MAX} requests per ${RL_WINDOW_MS / 1000}s`,
    );
    return;
  }

  timestamps.push(now);
  rlBuckets.set(key, timestamps);

  // Periodic cleanup to prevent memory leaks
  if (rlBuckets.size > 10000) {
    for (const [k, v] of rlBuckets) {
      const fresh = v.filter((t) => t > windowStart);
      if (fresh.length === 0) rlBuckets.delete(k);
      else rlBuckets.set(k, fresh);
    }
  }

  next();
});

// Routes
app.use('/api/lido', LidoRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbOk = false;
  if (DatabaseService.isConfigured()) {
    try {
      dbOk = await DatabaseService.getInstance().checkConnection();
    } catch { /* ignore */ }
  }

  const ethConfig = EthereumConfig.getInstance();
  const cbState = ethConfig.circuitBreaker;
  const cbStatus = {
    state: cbState.isOpen ? 'open' : 'closed',
  };

  const overallStatus = cbState.isOpen ? 'degraded' : 'healthy';

  res.status(200).json({
    status: overallStatus,
    service: 'lido-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    network: {
      name: 'Ethereum Mainnet',
      chainId: ethConfig.getChainId(),
    },
    circuitBreaker: cbStatus,
    database: {
      configured: DatabaseService.isConfigured(),
      connected: dbOk,
    },
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PanoramaBlock Lido Service',
    description: 'Lido staking service with centralized authentication',
    version: '1.0.0',
    authentication: 'Uses centralized auth-service (same as liquid-swap-service)',
    authEndpoints: {
      login: 'POST http://auth-service:3001/auth/login',
      verify: 'POST http://auth-service:3001/auth/verify',
      validate: 'POST http://auth-service:3001/auth/validate'
    },
    endpoints: {
      '/health': 'Health check',
      '/api/lido/stake': 'Stake ETH (requires JWT)',
      '/api/lido/unstake': 'Unstake stETH (requires JWT)',
      '/api/lido/position/:userAddress': 'Get staking position (optional JWT)',
      '/api/lido/protocol/info': 'Get protocol info (public)',
      '/api/lido/history/:userAddress': 'Get staking history (optional JWT)',
      '/api/lido/withdrawals/:userAddress': 'Get withdrawal requests (optional JWT)',
      '/api/lido/withdrawals/claim': 'Claim finalized withdrawals (requires JWT)',
      '/api/lido/transaction/submit': 'Record tx hash for prepared tx (requires JWT)',
      '/api/lido/transaction/:txHash': 'Get transaction status (public)'
    }
  });
});

// Error handling middleware
app.use(ErrorHandler.handle);

async function bootstrap() {
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

bootstrap().catch((err) => {
  logger.error(`Fatal bootstrap error: ${err}`);
  process.exit(1);
});

export default app;
