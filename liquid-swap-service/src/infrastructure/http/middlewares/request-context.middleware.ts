import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const incomingTrace =
    (req.headers['x-trace-id'] as string | undefined) ||
    (req.headers['x-request-id'] as string | undefined);

  const traceId = incomingTrace && typeof incomingTrace === 'string'
    ? incomingTrace
    : randomUUID();

  req.traceId = traceId;
  req.requestStartTime = Date.now();
  res.locals.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  next();
}
