import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../logs/logger';
import { ERROR_CODES, sendError } from '../../../shared/errorCodes';

export class ErrorHandler {
  private static logger = new Logger();

  static handle(error: Error, req: Request, res: Response, next: NextFunction): void {
    ErrorHandler.logger.error(`Unhandled error: ${error.message}`, {
      stack: error.stack,
      url: req.url,
      method: req.method,
      body: req.body
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? error.message : 'Internal server error';

    sendError(res, 500, ERROR_CODES.SERVICE_UNAVAILABLE, message);
  }

  static asyncWrapper(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}
