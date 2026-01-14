// Logger Configuration for TAC Service
// Minimal logger without external deps to avoid install issues in constrained environments.
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

function log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else if (level === 'debug') {
    if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') console.debug(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  error: (msg: string, meta?: any) => log('error', msg, meta),
  warn: (msg: string, meta?: any) => log('warn', msg, meta),
  info: (msg: string, meta?: any) => log('info', msg, meta),
  debug: (msg: string, meta?: any) => log('debug', msg, meta),
  log: (level: LogLevel, msg: string, meta?: any) => log(level, msg, meta),
};

// Context-aware logging helpers
export class ContextLogger {
  constructor(
    private context: {
      service?: string;
      userId?: string;
      operationId?: string;
      traceId?: string;
    } = {}
  ) { }

  private log(level: string, message: string, meta: any = {}) {
    logger.log(level as any, message, { ...this.context, ...meta });
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
