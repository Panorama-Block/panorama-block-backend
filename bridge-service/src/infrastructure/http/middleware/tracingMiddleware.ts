import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Injects a trace identifier into every request so logs and downstream services
 * can correlate activity. Honors any upstream X-Trace-ID header to preserve
 * existing observability data.
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerTraceId = Array.isArray(req.headers['x-trace-id'])
    ? req.headers['x-trace-id'][0]
    : req.headers['x-trace-id'];

  const traceId = typeof headerTraceId === 'string' && headerTraceId.trim().length > 0
    ? headerTraceId.trim()
    : uuidv4();

  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  next();
}
