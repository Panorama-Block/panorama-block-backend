import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { loadConfig } from './config.js';
import { buildApp, type SslOptions } from './http/app.js';
import { PrismaRepository, IdempotencyStore } from '../../../packages/infra-prisma/index.js';
import { createLogger } from '../../../packages/observability/index.js';

const DEFAULT_FULLCHAIN_PATH = '/etc/letsencrypt/live/api.panoramablock.com/fullchain.pem';
const DEFAULT_PRIVKEY_PATH = '/etc/letsencrypt/live/api.panoramablock.com/privkey.pem';

const getSSLOptions = (logger: Logger): SslOptions | null => {
  try {
    const certPath = process.env.FULLCHAIN ?? DEFAULT_FULLCHAIN_PATH;
    const keyPath = process.env.PRIVKEY ?? DEFAULT_PRIVKEY_PATH;

    logger.info({ certPath, keyPath }, 'Checking SSL certificates');

    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);

    if (certExists && keyExists) {
      logger.info('SSL certificates found, enabling HTTPS');
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    }

    logger.warn(
      { certExists, keyExists, certPath, keyPath },
      'SSL certificates not found, running over HTTP'
    );

    return null;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to load SSL certificates, running over HTTP');
    return null;
  }
};

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger();
  const prisma = new PrismaClient();
  const repository = new PrismaRepository(prisma);
  const idempotencyStore = new IdempotencyStore(prisma);
  const sslOptions = getSSLOptions(logger);
  const app = buildApp({
    config,
    prisma,
    repository,
    idempotencyStore,
    sslOptions
  });

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(
      { port: config.port, host: config.host, protocol: sslOptions ? 'https' : 'http' },
      'Gateway listening'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to start gateway');
    await prisma.$disconnect();
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gateway');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

void bootstrap();
