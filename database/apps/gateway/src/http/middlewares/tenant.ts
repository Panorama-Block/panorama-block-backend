import { FastifyReply, FastifyRequest } from 'fastify';

const isHealthRoute = (request: FastifyRequest): boolean => {
  return (request.routeOptions?.url ?? request.url) === '/health';
};

export const tenantMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  if (isHealthRoute(request)) {
    request.ctx = {
      requestId: request.id,
      headers: request.headers as Record<string, string>
    };
    return;
  }

  const tenantId = request.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    reply
      .status(400)
      .send({ error: 'tenant_required', message: 'x-tenant-id header required' });
    return;
  }

  request.ctx = {
    requestId: request.id,
    tenantId,
    headers: request.headers as Record<string, string>
  };
  return;
};
