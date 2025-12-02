import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LidoRoutes } from './infrastructure/http/routes/lidoRoutes';
import { ErrorHandler } from './infrastructure/http/middleware/errorHandler';
import { Logger } from './infrastructure/logs/logger';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3004;
const logger = new Logger();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/lido', LidoRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'lido-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3301',
    features: {
      authentication: 'centralized (auth-service)',
      staking: true,
      protocolInfo: true
    }
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
      login: 'POST http://auth-service:3301/auth/login',
      verify: 'POST http://auth-service:3301/auth/verify',
      validate: 'POST http://auth-service:3301/auth/validate'
    },
    endpoints: {
      '/health': 'Health check',
      '/api/lido/stake': 'Stake ETH (requires JWT)',
      '/api/lido/unstake': 'Unstake stETH (requires JWT)',
      '/api/lido/position/:userAddress': 'Get staking position (optional JWT)',
      '/api/lido/protocol/info': 'Get protocol info (public)',
      '/api/lido/transaction/:txHash': 'Get transaction status (public)'
    }
  });
});

// Error handling middleware
app.use(ErrorHandler.handle);

// Start server
app.listen(port, () => {
  logger.info(`🚀 Lido Service running on port ${port}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔐 Authentication: Centralized (auth-service at ${process.env.AUTH_SERVICE_URL || 'http://localhost:3301'})`);
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

export default app;
