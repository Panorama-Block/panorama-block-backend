// TAC Operation Routes - HTTP API endpoints for cross-chain operations
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DIContainer } from '../../di/container';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';

// Request schemas
const CreateOperationSchema = z.object({
  operationType: z.enum(['cross_chain_swap', 'cross_chain_lending', 'cross_chain_staking', 'cross_chain_yield_farming']),
  sourceChain: z.string().min(1),
  targetChain: z.string().min(1),
  inputToken: z.string().min(1),
  inputAmount: z.number().positive(),
  outputToken: z.string().optional(),
  protocol: z.string().optional(),
  protocolAction: z.string().optional(),
  conversationId: z.string().optional(),
  slippage: z.number().min(0).max(50).optional(),
  maxGasPrice: z.number().positive().optional()
});

const OperationFiltersSchema = z.object({
  status: z.enum(['initiated', 'bridging_to_evm', 'executing_protocol', 'bridging_back', 'completed', 'failed']).optional(),
  operationType: z.enum(['cross_chain_swap', 'cross_chain_lending', 'cross_chain_staking', 'cross_chain_yield_farming']).optional(),
  sourceChain: z.string().optional(),
  targetChain: z.string().optional(),
  protocol: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional()
});

export function createTacOperationRoutes(container: DIContainer): Router {
  const router = Router();

  // POST /api/tac/operations - Create new cross-chain operation
  router.post(
    '/',
    validationMiddleware(CreateOperationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const userId = req.user!.id;
        const operationData = req.body;

        requestLogger.info('Creating new TAC operation', { operationType: operationData.operationType });

        // Create operation
        const operation = await container.tacOperationService.createOperation({
          userId,
          ...operationData
        });

        // Start execution asynchronously
        container.tacOperationService.executeOperation(operation.id).catch(error => {
          requestLogger.error('Operation execution failed', { operationId: operation.id, error: error.message });
        });

        res.status(201).json({
          success: true,
          data: {
            operationId: operation.id,
            status: operation.status,
            operationType: operation.operationType,
            sourceChain: operation.sourceChain,
            targetChain: operation.targetChain,
            inputToken: operation.inputToken,
            inputAmount: operation.inputAmount,
            estimatedTime: operation.estimatedTime,
            createdAt: operation.createdAt,
            steps: operation.getSteps().map(step => ({
              stepType: step.stepType,
              stepName: step.stepName,
              status: step.status,
              order: step.stepOrder
            }))
          },
          message: 'Operation created and execution started',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to create TAC operation', { error: error.message });
        next(error);
      }
    }
  );

  // GET /api/tac/operations - Get user operations with filters
  router.get(
    '/',
    validationMiddleware(OperationFiltersSchema, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const userId = req.user!.id;
        const filters = req.query as any;
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        // Parse date filters
        const operationFilters = {
          ...filters,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined
        };

        requestLogger.info('Fetching user operations', { filters: operationFilters });

        const operations = await container.tacOperationService.getUserOperations(
          userId,
          operationFilters,
          limit,
          offset
        );

        res.json({
          success: true,
          data: operations.map(op => ({
            operationId: op.id,
            status: op.status,
            operationType: op.operationType,
            sourceChain: op.sourceChain,
            targetChain: op.targetChain,
            inputToken: op.inputToken,
            inputAmount: op.inputAmount,
            outputToken: op.outputToken,
            outputAmount: op.outputAmount,
            protocol: op.protocol,
            protocolAction: op.protocolAction,
            tacTransactionId: op.tacTransactionId,
            progress: op.getProgressPercentage(),
            estimatedTime: op.estimatedTime,
            actualTime: op.actualTime,
            errorMessage: op.errorMessage,
            canRetry: op.canRetry,
            createdAt: op.createdAt,
            startedAt: op.startedAt,
            completedAt: op.completedAt
          })),
          pagination: {
            limit,
            offset,
            hasMore: operations.length === limit
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to fetch user operations', { error: error.message });
        next(error);
      }
    }
  );

  // GET /api/tac/operations/:operationId - Get specific operation details
  router.get(
    '/:operationId',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { operationId } = req.params;
        const userId = req.user!.id;

        requestLogger.info('Fetching operation details', { operationId });

        const operation = await container.tacOperationService.getOperation(operationId);

        if (!operation) {
          return res.status(404).json({
            success: false,
            error: 'Operation not found',
            code: 'OPERATION_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        if (operation.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            code: 'OPERATION_ACCESS_DENIED',
            timestamp: new Date().toISOString()
          });
        }

        const statusInfo = await container.tacOperationService.getOperationStatus(operationId);

        res.json({
          success: true,
          data: {
            operationId: operation.id,
            status: operation.status,
            operationType: operation.operationType,
            sourceChain: operation.sourceChain,
            targetChain: operation.targetChain,
            inputToken: operation.inputToken,
            inputAmount: operation.inputAmount,
            outputToken: operation.outputToken,
            outputAmount: operation.outputAmount,
            protocol: operation.protocol,
            protocolAction: operation.protocolAction,
            tacTransactionId: operation.tacTransactionId,
            tacOperationHash: operation.tacOperationHash,
            currentStep: statusInfo.currentStep,
            totalSteps: statusInfo.totalSteps,
            progress: statusInfo.progress,
            estimatedTime: operation.estimatedTime,
            actualTime: operation.actualTime,
            estimatedTimeRemaining: statusInfo.estimatedTimeRemaining,
            totalFees: operation.totalFees,
            steps: operation.getSteps().map(step => ({
              stepType: step.stepType,
              stepName: step.stepName,
              status: step.status,
              order: step.stepOrder,
              chainId: step.chainId,
              transactionHash: step.transactionHash,
              blockNumber: step.blockNumber,
              gasUsed: step.gasUsed,
              gasCost: step.gasCost,
              inputToken: step.inputToken,
              inputAmount: step.inputAmount,
              outputToken: step.outputToken,
              outputAmount: step.outputAmount,
              startedAt: step.startedAt,
              completedAt: step.completedAt,
              duration: step.duration,
              errorMessage: step.errorMessage,
              metadata: step.metadata
            })),
            errorMessage: operation.errorMessage,
            errorCode: operation.errorCode,
            retryCount: operation.retryCount,
            canRetry: operation.canRetry,
            createdAt: operation.createdAt,
            startedAt: operation.startedAt,
            completedAt: operation.completedAt
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to fetch operation details', { operationId: req.params.operationId, error: error.message });
        next(error);
      }
    }
  );

  // POST /api/tac/operations/:operationId/cancel - Cancel operation
  router.post(
    '/:operationId/cancel',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { operationId } = req.params;
        const userId = req.user!.id;

        requestLogger.info('Cancelling operation', { operationId });

        await container.tacOperationService.cancelOperation(operationId, userId);

        res.json({
          success: true,
          message: 'Operation cancelled successfully',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to cancel operation', { operationId: req.params.operationId, error: error.message });
        next(error);
      }
    }
  );

  // POST /api/tac/operations/:operationId/retry - Retry failed operation
  router.post(
    '/:operationId/retry',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { operationId } = req.params;
        const userId = req.user!.id;

        requestLogger.info('Retrying failed operation', { operationId });

        await container.tacOperationService.retryFailedOperation(operationId, userId);

        res.json({
          success: true,
          message: 'Operation retry initiated successfully',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to retry operation', { operationId: req.params.operationId, error: error.message });
        next(error);
      }
    }
  );

  // GET /api/tac/operations/:operationId/status - Get operation status (lightweight endpoint)
  router.get(
    '/:operationId/status',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId!, req.user!.id);

      try {
        const { operationId } = req.params;
        const userId = req.user!.id;

        // Quick check if operation exists and user has access
        const operation = await container.tacOperationService.getOperation(operationId);
        if (!operation || operation.userId !== userId) {
          return res.status(404).json({
            success: false,
            error: 'Operation not found',
            code: 'OPERATION_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        const statusInfo = await container.tacOperationService.getOperationStatus(operationId);

        res.json({
          success: true,
          data: statusInfo,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        requestLogger.error('Failed to get operation status', { operationId: req.params.operationId, error: error.message });
        next(error);
      }
    }
  );

  return router;
}