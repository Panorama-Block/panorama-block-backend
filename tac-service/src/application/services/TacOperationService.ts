// TAC Operation Service - Core business logic for cross-chain operations
import { TacOperation, TacOperationStatus, TacOperationType } from '../../domain/entities/TacOperation';
import { CrossChainQuote } from '../../domain/entities/CrossChainQuote';
import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacSdkBridgeService } from '../../domain/interfaces/ITacSdkBridgeService';
import { INotificationService } from '../../domain/interfaces/INotificationService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';
import { BridgeRequest, BridgeResponse } from '../../domain/types/BridgeTypes';
import { logger, createTacOperationLogger } from '../../infrastructure/utils/logger';

export interface CreateOperationRequest {
  userId: string;
  conversationId?: string;
  operationType: TacOperationType;
  sourceChain: string;
  targetChain: string;
  inputToken: string;
  inputAmount: number;
  outputToken?: string;
  protocol?: string;
  protocolAction?: string;
  slippage?: number;
  maxGasPrice?: number;
}

export interface OperationFilters {
  userId?: string;
  status?: TacOperationStatus;
  operationType?: TacOperationType;
  sourceChain?: string;
  targetChain?: string;
  protocol?: string;
  startDate?: Date;
  endDate?: Date;
}

export class TacOperationService {
  constructor(
    private tacRepository: ITacRepository,
    private tacSdkService: ITacSdkBridgeService,
    private notificationService: INotificationService,
    private analyticsService: ITacAnalyticsService
  ) {}

  async createOperation(request: CreateOperationRequest): Promise<TacOperation> {
    const operationLogger = createTacOperationLogger('', request.userId);

    try {
      operationLogger.info('Creating TAC operation', { operationType: request.operationType });

      // Create operation entity
      const operation = new TacOperation({
        userId: request.userId,
        conversationId: request.conversationId,
        operationType: request.operationType,
        sourceChain: request.sourceChain,
        targetChain: request.targetChain,
        inputToken: request.inputToken,
        inputAmount: request.inputAmount,
        outputToken: request.outputToken,
        protocol: request.protocol,
        protocolAction: request.protocolAction
      });

      // Add initial steps based on operation type
      this.initializeOperationSteps(operation, request);

      // Save operation to repository
      const savedOperation = await this.tacRepository.saveOperation(operation);
      operationLogger.info('TAC operation created', { operationId: savedOperation.id });

      // Send notification
      await this.notificationService.sendOperationNotification(
        request.userId,
        'operation_started',
        savedOperation
      );

      // Track analytics
      await this.analyticsService.trackOperationCreated(savedOperation);

      return savedOperation;
    } catch (error) {
      operationLogger.error('Failed to create TAC operation', { error: error.message });
      throw new Error(`Failed to create operation: ${error.message}`);
    }
  }

  async executeOperation(operationId: string): Promise<void> {
    const operation = await this.tacRepository.findOperationById(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    const operationLogger = createTacOperationLogger(operationId, operation.userId);

    try {
      operationLogger.info('Starting TAC operation execution');

      // Update operation status to started
      operation.start();
      await this.tacRepository.updateOperation(operation);

      // Execute the operation steps
      await this.executeOperationSteps(operation);

      operationLogger.info('TAC operation execution completed');
    } catch (error) {
      operationLogger.error('TAC operation execution failed', { error: error.message });

      // Mark operation as failed
      operation.fail(error.message);
      await this.tacRepository.updateOperation(operation);

      // Send failure notification
      await this.notificationService.sendOperationNotification(
        operation.userId,
        'operation_failed',
        operation
      );

      // Track failure analytics
      await this.analyticsService.trackOperationFailed(operation, error.message);

      throw error;
    }
  }

  async getOperation(operationId: string): Promise<TacOperation | null> {
    return await this.tacRepository.findOperationById(operationId);
  }

  async getUserOperations(
    userId: string,
    filters?: OperationFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<TacOperation[]> {
    const searchFilters = { ...filters, userId };
    return await this.tacRepository.findOperations(searchFilters, limit, offset);
  }

  async getOperationStatus(operationId: string): Promise<{
    status: TacOperationStatus;
    currentStep: number;
    totalSteps: number;
    progress: number;
    estimatedTimeRemaining?: number;
  }> {
    const operation = await this.tacRepository.findOperationById(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    const totalSteps = operation.getSteps().length;
    const progress = operation.getProgressPercentage();

    return {
      status: operation.status,
      currentStep: operation.currentStep,
      totalSteps,
      progress,
      estimatedTimeRemaining: this.estimateTimeRemaining(operation)
    };
  }

  async cancelOperation(operationId: string, userId: string): Promise<void> {
    const operation = await this.tacRepository.findOperationById(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    if (operation.userId !== userId) {
      throw new Error('Unauthorized: Cannot cancel operation for another user');
    }

    if (!operation.canBeCancelled()) {
      throw new Error('Operation cannot be cancelled in current state');
    }

    const operationLogger = createTacOperationLogger(operationId, userId);

    try {
      operationLogger.info('Cancelling TAC operation');

      // Cancel with TAC SDK if operation is in progress
      if (operation.tacTransactionId) {
        await this.tacSdkService.cancelBridge(operation.tacTransactionId);
      }

      // Update operation status
      operation.fail('Cancelled by user');
      await this.tacRepository.updateOperation(operation);

      // Send cancellation notification
      await this.notificationService.sendOperationNotification(
        userId,
        'operation_cancelled',
        operation
      );

      operationLogger.info('TAC operation cancelled successfully');
    } catch (error) {
      operationLogger.error('Failed to cancel TAC operation', { error: error.message });
      throw new Error(`Failed to cancel operation: ${error.message}`);
    }
  }

  async retryFailedOperation(operationId: string, userId: string): Promise<void> {
    const operation = await this.tacRepository.findOperationById(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    if (operation.userId !== userId) {
      throw new Error('Unauthorized: Cannot retry operation for another user');
    }

    if (!operation.canRetry) {
      throw new Error('Operation cannot be retried');
    }

    const operationLogger = createTacOperationLogger(operationId, userId);

    try {
      operationLogger.info('Retrying failed TAC operation');

      // Reset operation for retry
      operation.resetForRetry();
      await this.tacRepository.updateOperation(operation);

      // Execute the operation again
      await this.executeOperation(operationId);

      operationLogger.info('TAC operation retry completed');
    } catch (error) {
      operationLogger.error('TAC operation retry failed', { error: error.message });
      throw error;
    }
  }

  private initializeOperationSteps(operation: TacOperation, request: CreateOperationRequest): void {
    switch (request.operationType) {
      case 'cross_chain_swap':
        operation.addStep('bridge_to_evm', { targetChain: request.targetChain });
        operation.addStep('protocol_execution', {
          protocol: request.protocol,
          action: 'swap',
          inputToken: request.inputToken,
          outputToken: request.outputToken
        });
        operation.addStep('bridge_to_ton', { resultToken: request.outputToken });
        break;

      case 'cross_chain_lending':
        operation.addStep('bridge_to_evm', { targetChain: request.targetChain });
        operation.addStep('protocol_execution', {
          protocol: request.protocol,
          action: request.protocolAction || 'supply',
          token: request.inputToken
        });
        break;

      case 'cross_chain_staking':
        operation.addStep('bridge_to_evm', { targetChain: request.targetChain });
        operation.addStep('protocol_execution', {
          protocol: request.protocol,
          action: 'stake',
          token: request.inputToken
        });
        break;

      case 'cross_chain_yield_farming':
        operation.addStep('bridge_to_evm', { targetChain: request.targetChain });
        operation.addStep('protocol_execution', {
          protocol: request.protocol,
          action: 'provide_liquidity',
          tokens: [request.inputToken, request.outputToken]
        });
        break;

      default:
        throw new Error(`Unsupported operation type: ${request.operationType}`);
    }
  }

  private async executeOperationSteps(operation: TacOperation): Promise<void> {
    const steps = operation.getSteps();
    const operationLogger = createTacOperationLogger(operation.id, operation.userId);

    for (let i = operation.currentStep; i < steps.length; i++) {
      const step = steps[i];

      try {
        operationLogger.info(`Executing step ${i + 1}/${steps.length}: ${step.stepType}`);

        // Update current step
        operation.currentStep = i;
        await this.tacRepository.updateOperation(operation);

        // Execute the step
        await this.executeStep(operation, step);

        // Mark step as completed
        step.complete();
        operation.updateStatus('in_progress');
        await this.tacRepository.updateOperation(operation);

        operationLogger.info(`Step ${i + 1} completed: ${step.stepType}`);

        // Send progress notification
        await this.notificationService.sendOperationNotification(
          operation.userId,
          'operation_progress',
          operation,
          { currentStep: i + 1, totalSteps: steps.length }
        );

      } catch (error) {
        operationLogger.error(`Step ${i + 1} failed: ${step.stepType}`, { error: error.message });

        // Mark step as failed
        step.fail(error.message);
        operation.fail(`Step ${step.stepType} failed: ${error.message}`);
        await this.tacRepository.updateOperation(operation);

        throw error;
      }
    }

    // All steps completed successfully
    operation.complete();
    await this.tacRepository.updateOperation(operation);

    // Send completion notification
    await this.notificationService.sendOperationNotification(
      operation.userId,
      'operation_completed',
      operation
    );

    // Track completion analytics
    await this.analyticsService.trackOperationCompleted(operation);
  }

  private async executeStep(operation: TacOperation, step: any): Promise<void> {
    const bridgeRequest: BridgeRequest = {
      fromChain: operation.sourceChain,
      toChain: operation.targetChain,
      fromToken: operation.inputToken,
      toToken: operation.outputToken || operation.inputToken,
      amount: operation.inputAmount,
      userAddress: `user_${operation.userId}`, // This would be the actual TON address
      metadata: {
        operationId: operation.id,
        stepType: step.stepType,
        protocol: operation.protocol,
        protocolAction: operation.protocolAction
      }
    };

    switch (step.stepType) {
      case 'bridge_to_evm':
        const bridgeResponse = await this.tacSdkService.bridgeFromTon(bridgeRequest);
        operation.tacTransactionId = bridgeResponse.transactionId;
        break;

      case 'protocol_execution':
        await this.executeProtocolAction(operation, step);
        break;

      case 'bridge_to_ton':
        await this.tacSdkService.bridgeToTon(bridgeRequest);
        break;

      default:
        throw new Error(`Unknown step type: ${step.stepType}`);
    }
  }

  private async executeProtocolAction(operation: TacOperation, step: any): Promise<void> {
    // This would integrate with specific protocol adapters
    // For now, we'll use the TAC SDK's protocol execution
    const protocolRequest = {
      protocol: operation.protocol!,
      action: operation.protocolAction!,
      token: operation.inputToken,
      amount: operation.inputAmount,
      userAddress: `user_${operation.userId}`,
      metadata: {
        operationId: operation.id,
        stepMetadata: step.metadata
      }
    };

    await this.tacSdkService.executeProtocol(protocolRequest);
  }

  private estimateTimeRemaining(operation: TacOperation): number | undefined {
    if (!operation.startedAt || operation.status !== 'in_progress') {
      return undefined;
    }

    const elapsedTime = Date.now() - operation.startedAt.getTime();
    const progress = operation.getProgressPercentage();

    if (progress <= 0) {
      return operation.estimatedTime ? operation.estimatedTime * 1000 : undefined;
    }

    const estimatedTotalTime = (elapsedTime / progress) * 100;
    return Math.max(0, estimatedTotalTime - elapsedTime);
  }
}