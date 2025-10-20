import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../config.js';
import { RepositoryPort } from '../../../../packages/core/ports/index.js';
import { IdempotencyStore } from '../../../../packages/infra-prisma/IdempotencyStore.js';
import { authPlugin } from '../../../../packages/auth/index.js';
import { tenantMiddleware } from './middlewares/tenant.js';
import { createIdempotencyMiddleware } from './middlewares/idempotency.js';
import { createCrudHandlers } from './handlers/crud.js';
import { createTransactHandler } from './handlers/transact.js';
import { createSearchEmbeddingHandler } from './handlers/searchEmbedding.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../packages/core/services/index.js';

export interface AppDependencies {
  config: AppConfig;
  prisma: PrismaClient;
  repository: RepositoryPort;
  idempotencyStore: IdempotencyStore;
  sslOptions?: SslOptions | null;
}

export interface SslOptions {
  key: Buffer;
  cert: Buffer;
}

export const buildApp = ({
  config,
  prisma,
  repository,
  idempotencyStore,
  sslOptions
}: AppDependencies): FastifyInstance => {
  const baseOptions = {
    logger: {
      level: config.logLevel
    }
  };

  const fastifyOptions = sslOptions
    ? ({
        ...baseOptions,
        https: {
          key: sslOptions.key,
          cert: sslOptions.cert
        }
      } as any)
    : baseOptions;

  const app = Fastify(fastifyOptions as any) as unknown as FastifyInstance;

  const crudHandlers = createCrudHandlers(repository, idempotencyStore);
  const transactHandler = createTransactHandler(repository, idempotencyStore);
  const searchHandler = createSearchEmbeddingHandler(repository);
  const idempotencyMiddleware = createIdempotencyMiddleware(idempotencyStore);

  app.register(sensible);
  app.register(authPlugin, {
    secret: config.jwtSecret,
    audience: config.jwtAudience,
    issuer: config.jwtIssuer
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.addHook('onRequest', async (request, reply) => {
    if (request.routerPath === '/health') {
      return;
    }
    await app.authenticate(request, reply);
  });

  app.addHook('preHandler', tenantMiddleware);
  app.addHook('preHandler', idempotencyMiddleware);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationError) {
      reply.status(400).send({ error: 'validation_error', message: error.message });
      return;
    }
    if (error instanceof ForbiddenError) {
      reply.status(403).send({ error: 'forbidden', message: error.message });
      return;
    }
    if (error instanceof NotFoundError) {
      reply.status(404).send({ error: 'not_found', message: error.message });
      return;
    }
    reply.status(500).send({ error: 'internal_server_error' });
  });

  app.get('/v1/:entity', crudHandlers.list);
  app.get('/v1/:entity/:id', crudHandlers.get);
  app.post('/v1/:entity', crudHandlers.create);
  app.patch('/v1/:entity/:id', crudHandlers.update);
  app.delete('/v1/:entity/:id', crudHandlers.delete);

  app.post('/v1/_transact', transactHandler);
  app.post('/v1/:entity/_search-embedding', searchHandler);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
};
