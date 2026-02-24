import 'dotenv/config';

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
}

export const loadConfig = (): AppConfig => {
  const port = Number(process.env.PORT ?? 8080);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }

  return {
    port,
    host: process.env.HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
};
