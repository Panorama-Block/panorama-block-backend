import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';
import { DIContainer } from '../../di/container';
import { TonSwapOperation } from '@prisma/client';

const QuoteSchema = z.object({
  tonAddress: z.string().min(10),
  toToken: z.string().min(1),
  amountIn: z.number().positive(),
  slippageBps: z.number().min(1).max(5000).default(100)
});

const ExecuteSchema = z.object({
  quoteId: z.string().uuid(),
  tonAddress: z.string().min(10)
});

const StatusSchema = z.object({
  operationId: z.string().min(1)
});

const WebhookSchema = z.object({
  operationId: z.string().min(1),
  status: z.enum(['pending', 'bridging', 'swapping', 'success', 'failed']).optional(),
  txHashTon: z.string().optional(),
  txHashTac: z.string().optional(),
  error: z.string().optional()
});

export function createTonSwapRoutes(container: DIContainer): Router {
  const router = Router();
  const tacChainId = process.env.TAC_CHAIN_ID || 'tac';
  const quoteTtlMs = Number(process.env.TON_SWAP_QUOTE_TTL_MS || 5 * 60 * 1000);

  router.post(
    '/quote',
    validationMiddleware(QuoteSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);
      try {
        const { tonAddress, toToken, amountIn, slippageBps } = req.body as z.infer<typeof QuoteSchema>;
        const userId = req.user!.id;
        const prisma = container.database;

        // Validate ton wallet ownership
        const tonWallet = await prisma.tonWallet.findUnique({ where: { tonAddressRaw: tonAddress } });
        if (!tonWallet || tonWallet.userId !== userId) {
          return res.status(403).json({ error: 'TON wallet not linked to this user' });
        }

        // Ensure EVM receiver bound to this user on TAC chain
        const evmWallet = await prisma.evmWallet.findUnique({
          where: { userId_chainId: { userId, chainId: tacChainId } }
        });
        if (!evmWallet) {
          return res.status(400).json({ error: 'No TAC receiver found. Register an EVM wallet first.' });
        }

        // Placeholder pricing (apply a 0.5% fee)
        const expectedOut = amountIn * 0.995;
        const expiresAt = new Date(Date.now() + quoteTtlMs);

        const quote = await prisma.tonSwapQuote.create({
          data: {
            userId,
            tonAddress,
            evmReceiver: evmWallet.address,
            toToken,
            amountIn,
            slippageBps,
            expectedOut,
            expiresAt
          }
        });

        requestLogger.info('TON->TAC quote created (stub)', { quoteId: quote.id, toToken, amountIn, expectedOut });

        return res.json({
          success: true,
          data: {
            quoteId: quote.id,
            toToken,
            amountIn,
            expectedOut,
            slippageBps,
            evmReceiver: evmWallet.address,
            chainId: tacChainId
          }
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  router.post(
    '/execute',
    validationMiddleware(ExecuteSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);
      try {
        const { quoteId, tonAddress } = req.body as z.infer<typeof ExecuteSchema>;
        const userId = req.user!.id;

        const prisma = container.database;
        const quote = await prisma.tonSwapQuote.findUnique({ where: { id: quoteId } });
        if (!quote || quote.userId !== userId || quote.tonAddress !== tonAddress) {
          return res.status(404).json({ error: 'Quote not found or not owned' });
        }

        if (quote.status === 'executed') {
          return res.status(400).json({ error: 'Quote already executed' });
        }
        if (new Date(quote.expiresAt).getTime() < Date.now()) {
          await prisma.tonSwapQuote.update({ where: { id: quoteId }, data: { status: 'expired' } });
          return res.status(400).json({ error: 'Quote expired' });
        }

        // Build minimal payload for TAC SDK sendCrossChainTransaction (frontend)
        const proxyAddress = process.env.TAC_UNISWAPV2_PROXY || process.env.TAC_PROXY_CONTRACT || undefined;
        const minOut = quote.expectedOut * (1 - quote.slippageBps / 10_000);

        const evmProxyMsg = {
          target: proxyAddress, // TAC UniswapV2 proxy contract
          action: 'swapExact', // descriptive
          params: {
            toToken: quote.toToken,
            minOut,
            receiver: quote.evmReceiver
          },
          metadata: {
            quoteId,
            slippageBps: quote.slippageBps
          }
        };

        const assets = {
          chain: 'ton',
          amount: quote.amountIn.toString(),
          token: 'TON'
        };

        const sdkResult = await container.tacSdkService.sendCrossChainTransaction({
          evmProxyMsg,
          senderTon: quote.tonAddress,
          assets,
          metadata: { quoteId }
        });

        const operationId = sdkResult.operationId || `op_${quoteId}`;

        await prisma.$transaction([
          prisma.tonSwapQuote.update({
            where: { id: quoteId },
            data: { status: 'executed', executedAt: new Date() }
          }),
          prisma.tonSwapOperation.create({
            data: {
              quoteId,
              userId,
              tonAddress: quote.tonAddress,
              evmReceiver: quote.evmReceiver,
              toToken: quote.toToken,
              amountIn: quote.amountIn,
              expectedOut: quote.expectedOut,
              slippageBps: quote.slippageBps,
              operationId,
              status: 'bridging',
              txHashTon: sdkResult.txHashTon
            }
          })
        ]);

        requestLogger.info('TON->TAC execute stub built', { quoteId, operationId });

        return res.json({
          success: true,
          data: {
            operationId,
            evmProxyMsg,
            assets,
            receiver: quote.evmReceiver
          }
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // GET status
  router.get(
    '/operations/:operationId',
    validationMiddleware(StatusSchema, 'params'),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);
      try {
        const { operationId } = req.params as any;
        const userId = req.user!.id;
        const prisma = container.database;

        const op = await prisma.tonSwapOperation.findUnique({ where: { operationId } });
        if (!op || op.userId !== userId) {
          return res.status(404).json({ error: 'Operation not found' });
        }
        return res.json({ success: true, data: op });
      } catch (error: any) {
        requestLogger.error('Failed to fetch operation', { error: error.message });
        next(error);
      }
    }
  );

  // Webhook/status update (protect via header token if set)
  router.post(
    '/webhook',
    validationMiddleware(WebhookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', 'webhook');
      try {
        const secret = process.env.TON_SWAP_WEBHOOK_SECRET;
        if (secret) {
          const provided = req.headers['x-webhook-secret'];
          if (provided !== secret) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
        }

        const { operationId, status, txHashTon, txHashTac, error } = req.body as z.infer<typeof WebhookSchema>;
        const prisma = container.database;

        const op = await prisma.tonSwapOperation.findUnique({ where: { operationId } });
        if (!op) {
          return res.status(404).json({ error: 'Operation not found' });
        }

        const data: Partial<TonSwapOperation> = {};
        if (status) data.status = status;
        if (txHashTon) data.txHashTon = txHashTon;
        if (txHashTac) data.txHashTac = txHashTac;
        if (error) data.error = error;

        const updated = await prisma.tonSwapOperation.update({
          where: { operationId },
          data
        });

        requestLogger.info('Operation updated via webhook', { operationId, status, txHashTon, txHashTac });
        return res.json({ success: true, data: updated });
      } catch (err: any) {
        requestLogger.error('Webhook update failed', { error: err.message });
        next(err);
      }
    }
  );

  return router;
}
