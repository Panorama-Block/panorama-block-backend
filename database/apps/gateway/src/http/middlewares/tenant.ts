import { FastifyReply, FastifyRequest } from 'fastify';

const isHealthRoute = (request: FastifyRequest): boolean => {
  return request.routerPath === '/health';
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

  const headerTenant = request.headers['x-tenant-id'] as string | undefined;
  const claimTenant =
    request.authClaims?.tenant ?? request.authClaims?.tenantId ?? undefined;

  if (headerTenant && claimTenant && headerTenant !== claimTenant) {
    reply
      .status(409)
      .send({ error: 'tenant_conflict', message: 'Tenant header does not match token claim' });
    return;
  }

  const tenantId = headerTenant ?? claimTenant;
  if (!tenantId) {
    reply
      .status(400)
      .send({ error: 'tenant_required', message: 'x-tenant-id header or tenant claim required' });
    return;
  }

  request.ctx = {
    requestId: request.id,
    tenantId,
    actor: {
      id: request.authClaims?.sub,
      roles: request.authClaims?.roles ?? [],
      service: request.authClaims?.service
    },
    headers: request.headers as Record<string, string>
  };
  return;
};
