import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../../utils/logger';

export interface JwtSecurityConfig {
  secret: string;
  issuer: string;
  audience: string;
}

type DecodedUser = JwtPayload & {
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
      const decoded = jwt.verify(token, config.secret, {
        algorithms: ['HS256', 'HS512'],
        issuer: config.issuer,
        audience: config.audience
      }) as DecodedUser;

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
