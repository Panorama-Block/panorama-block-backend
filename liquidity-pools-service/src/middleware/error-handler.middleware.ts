import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  console.error('[ErrorHandler] Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query
  });

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong!'
    : err.message;

  res.status(statusCode).json({
    success: false,
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};