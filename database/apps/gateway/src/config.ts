import 'dotenv/config';

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  authPrivateKey: string;
  authDomain: string;
}

export const loadConfig = (): AppConfig => {
  const port = Number(process.env.PORT ?? 8080);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }

  const authPrivateKey = process.env.AUTH_PRIVATE_KEY;
  if (!authPrivateKey) {
    throw new Error('AUTH_PRIVATE_KEY env var is required');
  }

  return {
    port,
    host: process.env.HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    authPrivateKey,
    authDomain: process.env.AUTH_DOMAIN ?? 'panoramablock.com',
  };
};
