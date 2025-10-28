import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { SwapError } from '../../../domain/entities/errors';
import {
  UserFacingErrorMapper,
  UserFacingErrorResult,
} from '../../../application/services/user-facing-error.mapper';

const mapper = new UserFacingErrorMapper();

export function createErrorResponder() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function errorResponder(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    if (res.headersSent) {
      return;
    }

    const traceId = req.traceId || randomUUID();
    const result: UserFacingErrorResult = mapper.map(err, traceId);

    // Preserve trace id header for downstream consumers
    res.setHeader('x-trace-id', traceId);

    logError(result, err);

    res.status(result.status).json(result.payload);
  };
}

function logError(result: UserFacingErrorResult, originalError: unknown) {
    const logPayload = {
      traceId: result.log.traceId,
      code: result.log.code,
      category: result.log.category,
      status: result.log.status,
      retryable: result.log.retryable,
    };

    if (originalError instanceof SwapError) {
      console.error('[ErrorResponder] SwapError', {
        ...logPayload,
        details: originalError.details,
        message: originalError.message,
        stack: originalError.stack,
      });
      return;
    }

    if (originalError instanceof Error) {
      console.error('[ErrorResponder] Error', {
        ...logPayload,
        message: originalError.message,
        stack: originalError.stack,
      });
      return;
    }

    console.error('[ErrorResponder] Unknown throwable', {
      ...logPayload,
      error: originalError,
    });
}
