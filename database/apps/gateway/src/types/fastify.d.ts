import 'fastify';
import { RequestCtx } from '../../../../packages/core/ports/index.js';

export interface IdempotencyContext {
  key: string;
  hash: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestCtx;
    idempotency?: IdempotencyContext;
  }
}
