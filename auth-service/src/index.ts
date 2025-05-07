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
const PORT = process.env.PORT;

// Set up middleware
app.use(express.json());
app.use(cors());

// Initialize ThirdWeb auth
getAuthInstance();

// Set up Redis client for session management
const redisClient: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASS || '',
});

redisClient.connect().catch(err => {
  console.error('Redis connection error:', err);
});

// Pass Redis client to routes
app.use('/auth', authRoutes(redisClient));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
}); 