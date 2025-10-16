import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RepositoryPort } from '../../../../../packages/core/ports/index.js';
import { entityConfigByCollection } from '../../../../../packages/core/entities.js';

const searchSchema = z.object({
  embedding: z.array(z.number()),
  k: z.number().int().min(1).max(100).default(10),
  filter: z.record(z.any()).optional()
});

interface Params {
  entity: string;
}

export const createSearchEmbeddingHandler = (repository: RepositoryPort) => {
  return async (request: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const { entity } = request.params;
    if (!entityConfigByCollection[entity]) {
      reply.status(400).send({ error: 'validation_error', message: `Unknown entity ${entity}` });
      return;
    }

    if (typeof repository.searchEmbedding !== 'function') {
      reply.status(501).send({ error: 'not_implemented', message: 'Vector search not available' });
      return;
    }

    let payload: z.infer<typeof searchSchema>;
    try {
      payload = searchSchema.parse(request.body);
    } catch (err) {
      reply.status(400).send({ error: 'validation_error', message: 'Invalid search payload' });
      return;
    }

    const result = await repository.searchEmbedding!(
      entity,
      payload.embedding,
      payload.k,
      payload.filter,
      request.ctx
    );
    reply.send({ data: result });
  };
};
