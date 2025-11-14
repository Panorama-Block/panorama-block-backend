import { Router } from 'express';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'PanoramaBlock TAC Service',
    version: '1.0.0',
    description: 'Cross-chain orchestration API for TAC operations'
  },
  servers: [
    { url: '/api', description: 'Gateway proxied API' }
  ],
  paths: {
    '/tac/quotes': { post: { summary: 'Generate cross-chain quote' } },
    '/tac/operations': { post: { summary: 'Initiate TAC operation' } },
    '/tac/balances': { get: { summary: 'List user balances' } }
  }
};

export function createDocsRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      service: 'TAC Service',
      version: '1.0.0',
      documentation: {
        openapi: '/docs/openapi.json',
        description: 'Use the OpenAPI document to explore endpoints. A full Redoc/Swagger UI integration can be added later.'
      },
      endpoints: {
        quotes: 'POST /api/tac/quotes',
        operations: 'POST /api/tac/operations',
        balances: 'GET /api/tac/balances',
        configuration: 'GET /api/tac/configuration',
        analytics: 'GET /api/tac/analytics/dashboard'
      }
    });
  });

  router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  return router;
}
