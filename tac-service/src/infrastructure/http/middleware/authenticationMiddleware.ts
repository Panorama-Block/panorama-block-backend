import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../../utils/logger';

export interface JwtSecurityConfig {
  secret: string;
  issuer: string;
  audience: string;
}

type DecodedUser = JwtPayload & {
  type?: string;
  role?: string;
  permissions?: string[];
  sub?: string;
  userId?: string;
};

/**
 * Verifies incoming JWTs (defaulting to Authorization: Bearer) and attaches the
 * decoded payload to `req.user` for downstream authorization.
 */
export function authenticationMiddleware(config: JwtSecurityConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing',
          traceId: req.traceId
        }
      });
      return;
    }

    try {
      let decoded: DecodedUser | null = null;
      let lastError: any = null;

      // First try TON JWT (TonConnect flow)
      const tonSecret = process.env.TON_JWT_SECRET;
      if (tonSecret) {
        try {
          decoded = jwt.verify(token, tonSecret, {
            algorithms: ['HS256', 'HS512'],
            issuer: process.env.TON_JWT_ISSUER || 'panoramablock-ton',
            audience: process.env.TON_JWT_AUDIENCE || 'panoramablock'
          }) as DecodedUser;
        } catch (err) {
          lastError = err;
        }
      }

      // Fallback to default TAC JWT
      if (!decoded) {
        try {
          decoded = jwt.verify(token, config.secret, {
            algorithms: ['HS256', 'HS512'],
            issuer: config.issuer,
            audience: config.audience
          }) as DecodedUser;
        } catch (err) {
          lastError = err;
        }
      }

      if (!decoded) {
        throw lastError || new Error('Token verification failed');
      }

      const userId = decoded.sub || decoded.userId || decoded.id;
      if (!userId) {
        throw new Error('Token payload missing subject');
      }

      req.user = {
        id: userId,
        role: decoded.role || 'user',
        ...decoded
      };

      next();
    } catch (error: any) {
      logger.warn('JWT verification failed', {
        traceId: req.traceId,
        reason: error?.message
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired authentication token',
          traceId: req.traceId
        }
      });
    }
  };
}
