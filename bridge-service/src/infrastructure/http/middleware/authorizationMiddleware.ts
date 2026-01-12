import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Ensures the authenticated user has one of the required roles before allowing
 * access to the route. Defaults to allowing any authenticated user when the
 * role list is empty.
 */
export function authorizationMiddleware(allowedRoles: string[] = []): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          traceId: req.traceId
        }
      });
      return;
    }

    if (allowedRoles.length === 0) {
      next();
      return;
    }

    const userRole = req.user.role || 'user';
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
          traceId: req.traceId
        }
      });
      return;
    }

    next();
  };
}
