import pino, { LoggerOptions } from 'pino';

export const createLogger = (options: LoggerOptions = {}) => {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    ...options
  });
};
