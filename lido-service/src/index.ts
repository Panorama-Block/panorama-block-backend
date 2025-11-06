import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LidoRoutes } from './infrastructure/http/routes/lidoRoutes';
import { AuthRoutes } from './infrastructure/http/routes/authRoutes';
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
app.use('/api/lido/auth', AuthRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'lido-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      authentication: true,
      staking: true,
      protocolInfo: true
    }
  });
});

// Error handling middleware
app.use(ErrorHandler.handle);

// Start server
app.listen(port, () => {
  logger.info(`Lido Service running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('JWT Authentication enabled');
  logger.info('Available endpoints:');
  logger.info('  - POST /api/lido/auth/login');
  logger.info('  - POST /api/lido/auth/refresh');
  logger.info('  - GET  /api/lido/auth/verify');
  logger.info('  - POST /api/lido/stake');
  logger.info('  - POST /api/lido/unstake');
  logger.info('  - GET  /api/lido/position/:userAddress');
});

export default app;
