// Logger Configuration for TAC Service
import winston from 'winston';
import path from 'path';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(logColors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, service, userId, operationId, traceId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'tac-service',
      ...(userId && { userId }),
      ...(operationId && { operationId }),
      ...(traceId && { traceId }),
      ...(stack && { stack }),
      ...meta
    };

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, userId, operationId, traceId, ...meta }) => {
    const serviceTag = service || 'tac-service';
    const contextInfo = [
      userId && `user:${userId}`,
      operationId && `op:${operationId}`,
      traceId && `trace:${traceId}`
    ].filter(Boolean).join(' ');

    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `[${timestamp}] ${level}: [${serviceTag}] ${contextInfo ? `(${contextInfo}) ` : ''}${message}${metaString}`;
  })
);

// Create logger instance
const createLogger = (): winston.Logger => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const nodeEnv = process.env.NODE_ENV || 'development';

  const transports: winston.transport[] = [];

  // Console transport for all environments
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: nodeEnv === 'production' ? structuredFormat : consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // File transports for production and test
  if (nodeEnv === 'production' || nodeEnv === 'test') {
    const logDir = path.resolve(process.cwd(), 'logs');

    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: structuredFormat,
        handleExceptions: true,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    );

    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        level: logLevel,
        format: structuredFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    );

    // TAC-specific operations log
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'tac-operations.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format((info) => {
            // Only log TAC operation related messages
            return info.operationId || info.message.includes('TAC') || info.message.includes('Operation')
              ? info
              : false;
          })(),
          structuredFormat
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10
      })
    );
  }

  return winston.createLogger({
    levels: logLevels,
    level: logLevel,
    format: structuredFormat,
    transports,
    exitOnError: false,
    silent: nodeEnv === 'test' && process.env.DISABLE_LOGGING === 'true'
  });
};

// Create and export logger instance
export const logger = createLogger();

// Context-aware logging helpers
export class ContextLogger {
  constructor(
    private context: {
      service?: string;
      userId?: string;
      operationId?: string;
      traceId?: string;
    } = {}
  ) {}

  private log(level: string, message: string, meta: any = {}) {
    logger.log(level, message, { ...this.context, ...meta });
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  child(additionalContext: Partial<typeof this.context>): ContextLogger {
    return new ContextLogger({ ...this.context, ...additionalContext });
  }
}

// TAC Operation specific logger
export function createTacOperationLogger(operationId: string, userId?: string): ContextLogger {
  return new ContextLogger({
    service: 'tac-service',
    operationId,
    userId
  });
}

// Request-specific logger
export function createRequestLogger(traceId: string, userId?: string): ContextLogger {
  return new ContextLogger({
    service: 'tac-service',
    traceId,
    userId
  });
}

// Performance logging helper
export function logPerformance(
  operation: string,
  startTime: number,
  context: { userId?: string; operationId?: string } = {}
): void {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, {
    duration,
    operation,
    ...context
  });
}

// Error logging helper with stack trace
export function logError(
  error: Error | unknown,
  context: {
    operation?: string;
    userId?: string;
    operationId?: string;
    traceId?: string;
  } = {}
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error(`Error in ${context.operation || 'unknown operation'}`, {
    error: errorObj.message,
    stack: errorObj.stack,
    ...context
  });
}

// Audit logging for sensitive operations
export function logAudit(
  action: string,
  result: 'success' | 'failure',
  context: {
    userId: string;
    operationId?: string;
    metadata?: Record<string, any>;
  }
): void {
  logger.info(`AUDIT: ${action}`, {
    audit: true,
    action,
    result,
    ...context
  });
}

// Health check logging
export function logHealthCheck(
  component: string,
  status: 'healthy' | 'unhealthy',
  metadata?: Record<string, any>
): void {
  logger.info(`Health check: ${component}`, {
    healthCheck: true,
    component,
    status,
    ...metadata
  });
}

export default logger;