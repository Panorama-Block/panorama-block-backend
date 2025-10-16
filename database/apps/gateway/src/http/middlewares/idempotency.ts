import { createHash } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { IdempotencyStore } from '../../../../../packages/infra-prisma/IdempotencyStore.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const computeHash = (request: FastifyRequest, tenantId?: string): string => {
  const body = request.body ? JSON.stringify(request.body) : '';
  const query = request.query ? JSON.stringify(request.query) : '';
  return createHash('sha256')
    .update(request.method)
    .update(':')
    .update(request.routerPath ?? request.url)
    .update(':')
    .update(tenantId ?? '')
    .update(':')
    .update(body)
    .update(':')
    .update(query)
    .digest('hex');
};

export const createIdempotencyMiddleware = (store: IdempotencyStore) => {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!WRITE_METHODS.has(request.method)) {
      return;
    }

    const keyHeader = request.headers['idempotency-key'];
    if (!keyHeader || typeof keyHeader !== 'string') {
      reply
        .status(400)
        .send({ error: 'idempotency_required', message: 'Idempotency-Key header required' });
      return;
    }

    const hash = computeHash(request, request.ctx?.tenantId);
    const existingHash = await store.getRequestHash(keyHeader);
    if (existingHash && existingHash !== hash) {
      reply
        .status(409)
        .send({ error: 'idempotency_conflict', message: 'Idempotency key already used' });
      return;
    }

    const existing = await store.find(keyHeader);
    if (existing) {
      reply.header('x-idempotent-replay', 'true');
      reply.send(existing.response);
      return;
    }

    request.idempotency = {
      key: keyHeader,
      hash
    };
  };
};

export const persistIdempotentResponse = async (
  request: FastifyRequest,
  response: unknown,
  store: IdempotencyStore
): Promise<void> => {
  if (!request.idempotency) {
    return;
  }
  await store.save(request.idempotency.key, request.idempotency.hash, response);
};
