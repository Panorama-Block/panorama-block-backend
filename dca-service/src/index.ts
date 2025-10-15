import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import { dcaRoutes } from './routes/dca.routes';
import { startDCAExecutor } from './jobs/dca.executor';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.DCA_PORT || 3003;

// Middleware
app.use(express.json());
app.use(cors());

// Environment logging
console.log('\n💰 [DCA SERVICE] Environment Variables:');
console.log('='.repeat(60));
console.log('📊 PORT:', PORT);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🔗 REDIS_HOST:', process.env.REDIS_HOST || 'localhost');
console.log('🔗 REDIS_PORT:', process.env.REDIS_PORT || '6379');
console.log('🔑 THIRDWEB_CLIENT_ID:', process.env.THIRDWEB_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('🔒 ENCRYPTION_PASSWORD:', process.env.ENCRYPTION_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('='.repeat(60));

// Initialize Redis client
const redisClient: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASS || '',
});

redisClient.connect().then(() => {
  console.log('[DCA Service] ✅ Connected to Redis successfully');

  // Start DCA executor cron job
  startDCAExecutor(redisClient);

}).catch(err => {
  console.error('[DCA Service] ❌ Redis connection error:', err);
  process.exit(1);
});

// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('[DCA Service] Redis client error:', err);
});

// Routes
app.use('/dca', dcaRoutes(redisClient));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 [HEALTH CHECK] DCA Service health check requested');
  res.status(200).json({
    status: 'ok',
    service: 'dca-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('🏠 [ROOT] Service info requested');
  res.json({
    name: 'PanoramaBlock DCA Service',
    description: 'Dollar Cost Averaging with Account Abstraction',
    version: '1.0.0',
    endpoints: {
      '/health': 'Health check',
      '/dca/create-account': 'Create smart account with session keys',
      '/dca/accounts/:userId': 'Get user smart accounts',
      '/dca/account/:address': 'Get smart account details',
      '/dca/create-strategy': 'Create DCA strategy',
      '/dca/strategies/:smartAccountId': 'Get account strategies',
      '/dca/history/:smartAccountId': 'Get execution history'
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Error] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unknown error occurred'
  });
});

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n🎉 [DCA Service] Server running successfully!`);
  console.log(`📊 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💰 DCA API: http://localhost:${PORT}/dca/`);
  console.log(`✨ Ready to handle DCA operations!\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[DCA Service] SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("[DCA Service] Server closed");
    redisClient.quit();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n[DCA Service] SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("[DCA Service] Server closed");
    redisClient.quit();
    process.exit(0);
  });
});
