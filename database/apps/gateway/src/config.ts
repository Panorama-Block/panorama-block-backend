import 'dotenv/config';

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  jwtSecret: string;
  jwtAudience?: string;
  jwtIssuer?: string;
}

export const loadConfig = (): AppConfig => {
  const port = Number(process.env.PORT ?? 8080);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET env var is required');
  }

  return {
    port,
    host: process.env.HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    jwtSecret,
    jwtAudience: process.env.JWT_AUDIENCE,
    jwtIssuer: process.env.JWT_ISSUER
  };
};
