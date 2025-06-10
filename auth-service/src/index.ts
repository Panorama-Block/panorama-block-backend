import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import authRoutes from './routes/auth';
import { getAuthInstance } from './utils/thirdwebAuth';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || process.env.AUTH_PORT || 3001;

// Set up middleware
app.use(express.json());
app.use(cors());

// Debug logging
if (process.env.DEBUG === 'true') {
  console.log('[Auth Service] Starting with environment:');
  console.log('- PORT:', PORT);
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- REDIS_HOST:', process.env.REDIS_HOST);
  console.log('- REDIS_PORT:', process.env.REDIS_PORT);
  console.log('- AUTH_DOMAIN:', process.env.AUTH_DOMAIN);
  console.log('- AUTH_PRIVATE_KEY:', process.env.AUTH_PRIVATE_KEY ? '[SET]' : '[NOT SET]');
}

// Initialize ThirdWeb auth
try {
  getAuthInstance();
  console.log('[Auth Service] ThirdWeb auth initialized successfully');
} catch (error) {
  console.error('[Auth Service] Failed to initialize ThirdWeb auth:', error);
  process.exit(1);
}

// Set up Redis client for session management
const redisClient: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASS || '',
});

redisClient.connect().then(() => {
  console.log('[Auth Service] Connected to Redis successfully');
}).catch(err => {
  console.error('[Auth Service] Redis connection error:', err);
  process.exit(1);
});

// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('[Auth Service] Redis client error:', err);
});

// Pass Redis client to routes
app.use('/auth', authRoutes(redisClient));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'auth-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PanoramaBlock Auth Service',
    description: 'Authentication service using ThirdWeb',
    version: '1.0.0',
    endpoints: {
      '/health': 'Health check',
      '/auth/login': 'Generate login payload',
      '/auth/verify': 'Verify signature and get JWT',
      '/auth/validate': 'Validate JWT token',
      '/auth/logout': 'Logout and invalidate session'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Auth Service] Running on port ${PORT}`);
  console.log(`[Auth Service] Health check available at http://localhost:${PORT}/health`);
}); 