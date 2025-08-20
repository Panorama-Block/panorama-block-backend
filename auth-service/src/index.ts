import express from 'express';
import cors from 'cors';
import https from 'https';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import authRoutes from './routes/auth';
import { getAuthInstance, isAuthConfigured } from './utils/thirdwebAuth';
import helmet from 'helmet';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || process.env.AUTH_PORT || 3001;

// SSL certificate options for HTTPS
const getSSLOptions = () => {
  try {
    const certPath = process.env.FULLCHAIN || "/etc/letsencrypt/live/x-api.panoramablock.com/fullchain.pem";
    const keyPath = process.env.PRIVKEY || "/etc/letsencrypt/live/x-api.panoramablock.com/privkey.pem";
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } else {
      console.warn('[Auth Service] SSL certificates not found. Running in HTTP mode.');
      return null;
    }
  } catch (error) {
    console.warn('[Auth Service] Error loading SSL certificates:', error);
    return null;
  }
};

// Set up middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Initialize ThirdWeb auth if configured
try { 
  if (isAuthConfigured()) {
    getAuthInstance();
    console.log('[Auth Service] ThirdWeb auth initialized successfully');
  } else {
    console.warn('[Auth Service] AUTH_PRIVATE_KEY not set. Auth endpoints will return 503 until configured.');
  }
} catch (error) {
  console.error('[Auth Service] Failed to initialize ThirdWeb auth:', error);
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
const sslOptions = getSSLOptions();

if (sslOptions && (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true')) {
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`[Auth Service] Running on HTTPS port ${PORT}`);
    console.log(`[Auth Service] Health check available at https://localhost:${PORT}/health`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`[Auth Service] Running on HTTP port ${PORT}`);
    console.log(`[Auth Service] Health check available at http://localhost:${PORT}/health`);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Auth Service] WARNING: Running in HTTP mode in production. SSL certificates not found.');
    }
  });
} 