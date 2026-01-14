import { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../../utils/logger';

/**
 * Logs basic request/response metadata with trace/user correlation to keep
 * HTTP traffic observable without flooding stdout.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestLogger = createRequestLogger(req.traceId || '', req.user?.id);

  requestLogger.info('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    requestLogger.info('Request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      contentLength: res.getHeader('content-length')
    });
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      const duration = Date.now() - startTime;
      requestLogger.warn('Request closed before completing response', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration
      });
    }
  });

  next();
}
