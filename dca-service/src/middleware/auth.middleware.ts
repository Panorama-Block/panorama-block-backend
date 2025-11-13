import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Extended Request type with authenticated user info
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Telegram Mini App Authentication Middleware
 * Validates initData from Telegram using HMAC-SHA256
 *
 * Security: This prevents anyone from forging requests by validating
 * the cryptographic signature from Telegram
 */
export function verifyTelegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Skip validation if user is already authenticated (e.g., by devBypassAuth)
    if (req.user) {
      return next();
    }

    // Get initData from header or body
    const initData = req.headers['x-telegram-init-data'] as string || req.body.initData;

    if (!initData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Telegram authentication data'
      });
    }

    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    if (!hash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authentication data'
      });
    }

    // Get bot token from env
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[Auth Middleware] TELEGRAM_BOT_TOKEN not set in environment!');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Authentication service not configured'
      });
    }

    // Validate HMAC
    // Step 1: Sort params alphabetically and create data-check-string
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Step 2: Create secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Step 3: Calculate HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    // Step 4: Compare hashes (constant-time comparison to prevent timing attacks)
    if (!crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash))) {
      console.warn('[Auth Middleware] Invalid HMAC signature');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authentication signature'
      });
    }

    // Step 5: Check auth_date to prevent replay attacks
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate);
      const maxAge = parseInt(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS || '3600'); // 1 hour default
      const now = Math.floor(Date.now() / 1000);

      if (now - authTimestamp > maxAge) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication data expired'
        });
      }
    }

    // Step 6: Extract user data
    const userJson = params.get('user');
    if (!userJson) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User data missing'
      });
    }

    const userData = JSON.parse(userJson);

    // Attach user to request
    req.user = {
      id: userData.id.toString(),
      telegramId: userData.id,
      username: userData.username,
      firstName: userData.first_name,
      lastName: userData.last_name
    };

    console.log(`[Auth Middleware] ✅ Authenticated user: ${req.user.id} (${req.user.username || 'no username'})`);
    next();

  } catch (error: any) {
    console.error('[Auth Middleware] Error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

/**
 * Middleware to check if authenticated user matches userId in request
 * Use this AFTER verifyTelegramAuth
 */
export function requireOwnership(paramName: string = 'userId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Check param, query, or body
    const requestedUserId = req.params[paramName] || req.query[paramName] || req.body[paramName];

    if (!requestedUserId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Missing ${paramName}`
      });
    }

    // Verify ownership
    if (req.user.id !== requestedUserId.toString()) {
      console.warn(`[Ownership Check] User ${req.user.id} tried to access ${requestedUserId}'s data`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own data'
      });
    }

    next();
  };
}

/**
 * Development/Browser mode bypass
 * Allows using x-dev-user-id when not in Telegram WebApp
 * Can be used in production for browser access
 */
export function devBypassAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check if request has x-dev-user-id header (browser mode)
  const devUserId = req.headers['x-dev-user-id'] as string;

  if (devUserId) {
    // Extract numeric ID if it's an address
    let numericId: number;
    if (devUserId.startsWith('0x')) {
      // It's an Ethereum address, use last 8 characters as numeric ID
      numericId = parseInt(devUserId.slice(-8), 16);
    } else {
      numericId = parseInt(devUserId) || 0;
    }

    req.user = {
      id: devUserId,
      telegramId: numericId,
      username: 'browser-user',
      firstName: 'Browser',
      lastName: 'User'
    };
    console.log(`[Browser Mode] Authenticated user: ${devUserId.slice(0, 10)}...`);
    return next();
  }

  // If no dev header, proceed with Telegram auth
  next();
}
