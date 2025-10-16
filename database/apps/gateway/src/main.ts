import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { buildApp } from './http/app.js';
import { PrismaRepository, IdempotencyStore } from '../../../packages/infra-prisma/index.js';
import { createLogger } from '../../../packages/observability/index.js';

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const repository = new PrismaRepository(prisma);
  const idempotencyStore = new IdempotencyStore(prisma);
  const app = buildApp({
    config,
    prisma,
    repository,
    idempotencyStore
  });

  const logger = createLogger();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'Gateway listening');
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
