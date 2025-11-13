// TAC Quote Routes - HTTP API endpoints for cross-chain quotes
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DIContainer } from '../../di/container';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';

// Request schemas
const QuoteRequestSchema = z.object({
  fromChain: z.string().min(1),
  toChain: z.string().min(1),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.number().positive(),
  operationType: z.enum(['cross_chain_swap', 'cross_chain_lending', 'cross_chain_staking', 'cross_chain_yield_farming']),
  slippage: z.number().min(0).max(50).optional(),
  prioritizeSpeed: z.boolean().optional(),
  preferredProtocols: z.array(z.string()).optional(),
  blacklistedProtocols: z.array(z.string()).optional()
});

const QuoteFiltersSchema = z.object({
  includeExpired: z.string().transform(v => v === 'true').optional(),
  limit: z.string().transform(Number).optional()
});

const CompareProvidersSchema = z.object({
  fromChain: z.string().min(1),
  toChain: z.string().min(1),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.number().positive(),
  operationType: z.enum(['cross_chain_swap', 'cross_chain_lending', 'cross_chain_staking', 'cross_chain_yield_farming'])
});

export function createTacQuoteRoutes(container: DIContainer): Router {
  const router = Router();

  // POST /api/tac/quotes - Generate new cross-chain quote
  router.post(
    '/',
    validationMiddleware(QuoteRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const userId = req.user!.id;
        const quoteRequest = req.body;

        requestLogger.info('Generating cross-chain quote', {
          fromChain: quoteRequest.fromChain,
          toChain: quoteRequest.toChain,
          operationType: quoteRequest.operationType,
          amount: quoteRequest.amount
        });

        const quoteResponse = await container.tacQuoteService.generateQuote(
          { userId, ...quoteRequest },
          req.traceId
        );

        res.status(201).json({
          success: true,
          data: {
            quote: {
              quoteId: quoteResponse.quote.id,
              fromChain: quoteResponse.quote.fromChain,
              toChain: quoteResponse.quote.toChain,
              fromToken: quoteResponse.quote.fromToken,
              toToken: quoteResponse.quote.toToken,
              amount: quoteResponse.quote.amount,
              operationType: quoteResponse.quote.operationType,
              route: {
                provider: quoteResponse.quote.route.provider,
                protocolSteps: quoteResponse.quote.route.protocolSteps,
                estimatedOutput: quoteResponse.quote.route.estimatedOutput,
                priceImpact: quoteResponse.quote.route.priceImpact,
                totalFees: quoteResponse.quote.route.totalFees,
                estimatedTime: quoteResponse.quote.route.estimatedTime,
                confidence: quoteResponse.quote.route.confidence
              },
              expiresAt: quoteResponse.quote.expiresAt,
              createdAt: quoteResponse.quote.createdAt
            },
            alternatives: quoteResponse.alternatives.map(alt => ({
              provider: alt.provider,
              route: {
                provider: alt.route.provider,
                estimatedOutput: alt.route.estimatedOutput,
                priceImpact: alt.route.priceImpact,
                totalFees: alt.route.totalFees,
                estimatedTime: alt.route.estimatedTime,
                confidence: alt.route.confidence
              },
              savings: alt.savings,
              tradeOffs: alt.tradeOffs
            })),
            estimatedSavings: quoteResponse.estimatedSavings ? {
              cheapestRoute: {
                provider: quoteResponse.estimatedSavings.cheapestRoute.provider,
                estimatedOutput: quoteResponse.estimatedSavings.cheapestRoute.estimatedOutput,
                totalFees: quoteResponse.estimatedSavings.cheapestRoute.totalFees,
                estimatedTime: quoteResponse.estimatedSavings.cheapestRoute.estimatedTime
              },
              fastestRoute: {
                provider: quoteResponse.estimatedSavings.fastestRoute.provider,
                estimatedOutput: quoteResponse.estimatedSavings.fastestRoute.estimatedOutput,
                totalFees: quoteResponse.estimatedSavings.fastestRoute.totalFees,
                estimatedTime: quoteResponse.estimatedSavings.fastestRoute.estimatedTime
              },
              balancedRoute: {
                provider: quoteResponse.estimatedSavings.balancedRoute.provider,
                estimatedOutput: quoteResponse.estimatedSavings.balancedRoute.estimatedOutput,
                totalFees: quoteResponse.estimatedSavings.balancedRoute.totalFees,
                estimatedTime: quoteResponse.estimatedSavings.balancedRoute.estimatedTime
              }
            } : undefined
          },
          message: 'Quote generated successfully',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to generate quote', { error: error.message });
        next(error);
      }
    }
  );

  // GET /api/tac/quotes - Get user quotes
  router.get(
    '/',
    validationMiddleware(QuoteFiltersSchema, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const userId = req.user!.id;
        const { includeExpired = false, limit = 20 } = req.query as any;

        requestLogger.info('Fetching user quotes', { includeExpired, limit });

        const quotes = await container.tacQuoteService.getUserQuotes(
          userId,
          includeExpired,
          limit
        );

        res.json({
          success: true,
          data: quotes.map(quote => ({
            quoteId: quote.id,
            fromChain: quote.fromChain,
            toChain: quote.toChain,
            fromToken: quote.fromToken,
            toToken: quote.toToken,
            amount: quote.amount,
            operationType: quote.operationType,
            route: {
              provider: quote.route.provider,
              estimatedOutput: quote.route.estimatedOutput,
              priceImpact: quote.route.priceImpact,
              totalFees: quote.route.totalFees,
              estimatedTime: quote.route.estimatedTime,
              confidence: quote.route.confidence
            },
            isExecuted: quote.isExecuted,
            executedAt: quote.executedAt,
            operationId: quote.operationId,
            isExpired: quote.isExpired(),
            expiresAt: quote.expiresAt,
            createdAt: quote.createdAt
          })),
          pagination: {
            limit,
            hasMore: quotes.length === limit
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to fetch user quotes', { error: error.message });
        next(error);
      }
    }
  );

  // GET /api/tac/quotes/:quoteId - Get specific quote details
  router.get(
    '/:quoteId',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { quoteId } = req.params;
        const userId = req.user!.id;

        requestLogger.info('Fetching quote details', { quoteId });

        const quote = await container.tacQuoteService.getQuote(quoteId);

        if (!quote) {
          return res.status(404).json({
            success: false,
            error: 'Quote not found',
            code: 'QUOTE_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        if (quote.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            code: 'QUOTE_ACCESS_DENIED',
            timestamp: new Date().toISOString()
          });
        }

        res.json({
          success: true,
          data: {
            quoteId: quote.id,
            fromChain: quote.fromChain,
            toChain: quote.toChain,
            fromToken: quote.fromToken,
            toToken: quote.toToken,
            amount: quote.amount,
            operationType: quote.operationType,
            route: quote.route,
            alternatives: quote.alternatives,
            metadata: quote.metadata,
            isExecuted: quote.isExecuted,
            executedAt: quote.executedAt,
            operationId: quote.operationId,
            isExpired: quote.isExpired(),
            expiresAt: quote.expiresAt,
            createdAt: quote.createdAt
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to fetch quote details', { quoteId: req.params.quoteId, error: error.message });
        next(error);
      }
    }
  );

  // POST /api/tac/quotes/:quoteId/execute - Execute quote
  router.post(
    '/:quoteId/execute',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { quoteId } = req.params;
        const userId = req.user!.id;

        requestLogger.info('Executing quote', { quoteId });

        const operationId = await container.tacQuoteService.executeQuote(quoteId, userId);

        res.json({
          success: true,
          data: {
            operationId,
            message: 'Quote executed successfully, operation started'
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to execute quote', { quoteId: req.params.quoteId, error: error.message });
        next(error);
      }
    }
  );

  // POST /api/tac/quotes/:quoteId/refresh - Refresh expired quote
  router.post(
    '/:quoteId/refresh',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { quoteId } = req.params;

        requestLogger.info('Refreshing quote', { quoteId });

        const newQuote = await container.tacQuoteService.refreshQuote(quoteId);

        res.json({
          success: true,
          data: {
            quoteId: newQuote.id,
            fromChain: newQuote.fromChain,
            toChain: newQuote.toChain,
            fromToken: newQuote.fromToken,
            toToken: newQuote.toToken,
            amount: newQuote.amount,
            operationType: newQuote.operationType,
            route: {
              provider: newQuote.route.provider,
              protocolSteps: newQuote.route.protocolSteps,
              estimatedOutput: newQuote.route.estimatedOutput,
              priceImpact: newQuote.route.priceImpact,
              totalFees: newQuote.route.totalFees,
              estimatedTime: newQuote.route.estimatedTime,
              confidence: newQuote.route.confidence
            },
            expiresAt: newQuote.expiresAt,
            createdAt: newQuote.createdAt
          },
          message: 'Quote refreshed successfully',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to refresh quote', { quoteId: req.params.quoteId, error: error.message });
        next(error);
      }
    }
  );

  // POST /api/tac/quotes/compare-providers - Compare different bridge providers
  router.post(
    '/compare-providers',
    validationMiddleware(CompareProvidersSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const userId = req.user!.id;
        const compareRequest = req.body;

        requestLogger.info('Comparing bridge providers', {
          fromChain: compareRequest.fromChain,
          toChain: compareRequest.toChain,
          operationType: compareRequest.operationType
        });

        const comparison = await container.tacQuoteService.compareProviders({
          userId,
          ...compareRequest
        });

        res.json({
          success: true,
          data: {
            providers: comparison.providers.map(provider => ({
              name: provider.name,
              route: {
                provider: provider.route.provider,
                estimatedOutput: provider.route.estimatedOutput,
                priceImpact: provider.route.priceImpact,
                totalFees: provider.route.totalFees,
                estimatedTime: provider.route.estimatedTime,
                confidence: provider.route.confidence
              },
              pros: provider.pros,
              cons: provider.cons,
              recommendation: provider.recommendation
            })),
            summary: {
              totalProviders: comparison.providers.length,
              recommendations: {
                bestPrice: comparison.providers.find(p => p.recommendation === 'best_price')?.name,
                fastest: comparison.providers.find(p => p.recommendation === 'fastest')?.name,
                mostReliable: comparison.providers.find(p => p.recommendation === 'most_reliable')?.name,
                balanced: comparison.providers.find(p => p.recommendation === 'balanced')?.name
              }
            }
          },
          message: 'Provider comparison completed',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to compare providers', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}