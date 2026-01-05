import { Request, Response, NextFunction } from 'express';

/**
 * Extended Request type with authenticated user info
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    address: string;
    sessionId?: string;
    payload?: any;
  };
}

/**
 * Bearer JWT authentication via auth-service (/auth/validate)
 * Canonical identity = wallet address
 */
export async function verifyJwtAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.user) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid bearer token' });
    }

    const authServiceUrl = process.env.AUTH_SERVICE_URL || process.env.AUTH_API_BASE || 'http://localhost:3301';

    const response = await fetch(`${authServiceUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'validation failed');
      return res.status(401).json({ error: 'Unauthorized', message: errText });
    }

    const data = await response.json() as { isValid: boolean; payload?: any };
    if (!data.isValid || !data.payload) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }

    const address = (data.payload.address || data.payload.sub || '').toLowerCase();
    if (!address) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token missing address' });
    }

    req.user = {
      id: address,
      address,
      sessionId: data.payload.sessionId,
      payload: data.payload,
    };

    return next();
  } catch (error: any) {
    console.error('[Auth Middleware] JWT validation error:', error);
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication failed' });
  }
}

/**
 * Middleware to check if authenticated user matches userId in request
 * Use this AFTER verifyJwtAuth
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
    const requestedUserId = (req.params[paramName] || req.query[paramName] || req.body[paramName]) as string | undefined;

    if (!requestedUserId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Missing ${paramName}`
      });
    }

    // Verify ownership (case-insensitive)
    if (req.user.address.toLowerCase() !== requestedUserId.toString().toLowerCase()) {
      console.warn(`[Ownership Check] User ${req.user.address} tried to access ${requestedUserId}'s data`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own data'
      });
    }

    next();
  };
}
