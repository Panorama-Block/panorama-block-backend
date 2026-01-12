import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';

interface HttpError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandlingMiddleware(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        })),
        traceId: req.traceId
      }
    });
    return;
  }

  logger.error('Unhandled error', {
    traceId: req.traceId,
    status,
    message: err.message,
    stack: err.stack
  });

  res.status(status).json({
    success: false,
    error: {
      code,
      message: status === 500 ? 'Unexpected server error' : err.message,
      details: err.details,
      traceId: req.traceId
    }
  });
}
