import rateLimit from 'express-rate-limit';

/**
 * Rate limiting configurations for different endpoints
 * Prevents abuse and DoS attacks
 */

/**
 * General API rate limit (applies to most endpoints)
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

/**
 * Strict rate limit for account creation
 * 5 accounts per 1 hour per IP
 * Prevents bulk account creation attacks
 */
export const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 accounts per hour
  message: {
    error: 'Too many accounts created',
    message: 'You can only create 5 smart accounts per hour. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Optional: Skip rate limit for authenticated requests (trust Telegram auth)
  skip: (req) => {
    // If you want to allow unlimited for authenticated users, uncomment:
    // return !!req.user;
    return false;
  }
});

/**
 * Strict rate limit for strategy creation
 * 10 strategies per 15 minutes per IP
 */
export const createStrategyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 strategies per window
  message: {
    error: 'Too many strategies created',
    message: 'You can only create 10 DCA strategies per 15 minutes. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit for transaction signing
 * 20 transactions per 5 minutes per IP
 * Prevents rapid draining of accounts
 */
export const transactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 transactions per window
  message: {
    error: 'Too many transactions',
    message: 'You can only execute 20 transactions per 5 minutes. Please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limit for read operations
 * 200 requests per 15 minutes per IP
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit for read operations. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limit for debug endpoints (should be disabled in production)
 * 10 requests per hour per IP
 */
export const debugLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    error: 'Too many debug requests',
    message: 'Debug endpoints are rate limited. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit in development
  skip: (req) => process.env.NODE_ENV === 'development'
});
