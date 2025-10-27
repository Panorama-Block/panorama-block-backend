import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthPluginOptions {
  secret: string;
  audience?: string;
  issuer?: string;
}

export interface ServiceTokenClaims {
  sub?: string;
  roles?: string[];
  tenant?: string;
  tenantId?: string;
  service?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authClaims?: ServiceTokenClaims;
  }

  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const ensureToken = (request: FastifyRequest): void => {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Unsupported authorization scheme');
  }
};

export const authPlugin = fp<AuthPluginOptions>(async (app, opts) => {
  app.register(fastifyJwt, {
    secret: opts.secret
  });

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        ensureToken(request);
        const claims = await request.jwtVerify<ServiceTokenClaims>();
        if (opts.audience) {
          const aud = (claims as any)?.aud;
          const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
          if (!audiences.includes(opts.audience)) {
            throw new Error('Invalid audience');
          }
        }
        if (opts.issuer) {
          const iss = (claims as any)?.iss;
          if (iss !== opts.issuer) {
            throw new Error('Invalid issuer');
          }
        }
        request.authClaims = claims;
      } catch (err) {
        request.log.warn({ err }, 'JWT verification failed');
        reply.status(401).send({ error: 'unauthorized', message: 'Invalid or missing token' });
        return;
      }
    }
  );
});
