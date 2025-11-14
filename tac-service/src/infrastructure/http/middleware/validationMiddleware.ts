import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestProperty = 'body' | 'query' | 'params' | 'headers';

/**
 * Generic Zod validation middleware that can validate any portion of the request.
 */
export function validationMiddleware<T>(
  schema: ZodSchema<T>,
  property: RequestProperty = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const payload = req[property];
    const result = schema.safeParse(payload);

    if (!result.success) {
      const error = new ZodError(result.error.issues);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          })),
          traceId: req.traceId
        }
      });
      return;
    }

    (req as any)[property] = result.data;
    next();
  };
}
