import { ThirdwebAuth } from '@thirdweb-dev/auth';
import { PrivateKeyWallet } from '@thirdweb-dev/auth/evm';
import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthPluginOptions {
  authPrivateKey: string;
  authDomain: string;
}

export interface ServiceTokenClaims {
  sub?: string;
  iss?: string;
  aud?: string;
  address?: string;
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

// ---------------------------------------------------------------------------
// ThirdwebAuth singleton
// ---------------------------------------------------------------------------

let authInstance: any = null;

function getAuthInstance(privateKey: string, domain: string): any {
  if (!authInstance) {
    const wallet = new PrivateKeyWallet(privateKey);
    authInstance = new ThirdwebAuth(wallet, domain);
  }
  return authInstance;
}

async function validateToken(
  token: string,
  privateKey: string,
  domain: string,
): Promise<ServiceTokenClaims> {
  const auth = getAuthInstance(privateKey, domain);

  try {
    const result = await auth.authenticate(token, { domain });
    return {
      sub: result.address,
      address: result.address,
      ...result,
    } as ServiceTokenClaims;
  } catch (error: any) {
    // Fallback: dev environment where domain may differ slightly
    if (
      error.message &&
      error.message.includes("found token with domain 'panoramablock'")
    ) {
      const result = await auth.authenticate(token, {
        domain: 'panoramablock',
      });
      return {
        sub: result.address,
        address: result.address,
        ...result,
      } as ServiceTokenClaims;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Fastify plugin
// ---------------------------------------------------------------------------

const ensureToken = (request: FastifyRequest): string => {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Unsupported authorization scheme');
  }
  return authHeader.slice(7);
};

export const authPlugin = fp<AuthPluginOptions>(async (app, opts) => {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const token = ensureToken(request);
        const claims = await validateToken(
          token,
          opts.authPrivateKey,
          opts.authDomain,
        );
        request.authClaims = claims;
      } catch (err) {
        request.log.warn({ err }, 'JWT verification failed');
        reply
          .status(401)
          .send({ error: 'unauthorized', message: 'Invalid or missing token' });
      }
    },
  );
});
