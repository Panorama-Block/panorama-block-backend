import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.PORT = process.env.PORT ?? '8080';

export const signTestToken = (claims: Record<string, unknown> = {}): string => {
  return jwt.sign(
    {
      sub: 'test-service',
      service: 'gateway-test',
      roles: ['admin'],
      tenant: 'tenant-test',
      ...claims
    },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  );
};
