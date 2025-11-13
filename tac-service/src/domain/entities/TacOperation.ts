import { randomUUID } from 'crypto';

export type TacOperationStatus =
  | 'initiated'
  | 'bridging_to_evm'
  | 'executing_protocol'
  | 'bridging_back'
  | 'completed'
  | 'failed';

export type TacOperationType =
  | 'cross_chain_swap'
  | 'cross_chain_lending'
  | 'cross_chain_staking'
  | 'cross_chain_yield_farming';

export interface TacOperationProps {
  id?: string;
  userId: string;
  conversationId?: string;
  operationType: TacOperationType;
  status: TacOperationStatus;
  sourceChain: string;
  targetChain: string;
  inputToken: string;
  inputAmount: string;
  outputToken?: string;
  outputAmount?: string;
  protocol?: string;
  protocolAction?: string;
  tacTransactionId?: string;
  tacOperationHash?: string;
  estimatedTime?: number;
  actualTime?: number;
  totalFees?: string;
  steps?: TacOperationStep[];
  currentStep?: number;
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  canRetry?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TacOperationStep {
  id: string;
  stepType: string;
  stepOrder: number;
  stepName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  chainId?: number;
  transactionHash?: string;
  blockNumber?: bigint;
  gasUsed?: bigint;
  gasCost?: string;
  confirmations?: number;
  inputToken?: string;
  inputAmount?: string;
  outputToken?: string;
  outputAmount?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  errorCode?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export class TacOperation {
  private readonly props: TacOperationProps;

  constructor(props: TacOperationProps) {
    this.props = {
      ...props,
      id: props.id || randomUUID(),
      steps: props.steps || [],
      currentStep: props.currentStep || 0,
      retryCount: props.retryCount || 0,
      canRetry: props.canRetry !== false,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date()
    };

    this.validate();
  }

  // Getters
  get id(): string { return this.props.id!; }
  get userId(): string { return this.props.userId; }
  get conversationId(): string | undefined { return this.props.conversationId; }
  get operationType(): TacOperationType { return this.props.operationType; }
  get status(): TacOperationStatus { return this.props.status; }
  get sourceChain(): string { return this.props.sourceChain; }
  get targetChain(): string { return this.props.targetChain; }
  get inputToken(): string { return this.props.inputToken; }
  get inputAmount(): string { return this.props.inputAmount; }
  get outputToken(): string | undefined { return this.props.outputToken; }
  get outputAmount(): string | undefined { return this.props.outputAmount; }
  get protocol(): string | undefined { return this.props.protocol; }
  get protocolAction(): string | undefined { return this.props.protocolAction; }
  get tacTransactionId(): string | undefined { return this.props.tacTransactionId; }
  get tacOperationHash(): string | undefined { return this.props.tacOperationHash; }
  get estimatedTime(): number | undefined { return this.props.estimatedTime; }
  get actualTime(): number | undefined { return this.props.actualTime; }
  get totalFees(): string | undefined { return this.props.totalFees; }
  get steps(): TacOperationStep[] { return this.props.steps!; }
  get currentStep(): number { return this.props.currentStep!; }
  get errorMessage(): string | undefined { return this.props.errorMessage; }
  get errorCode(): string | undefined { return this.props.errorCode; }
  get retryCount(): number { return this.props.retryCount!; }
  get lastRetryAt(): Date | undefined { return this.props.lastRetryAt; }
  get canRetry(): boolean { return this.props.canRetry!; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }
  get startedAt(): Date | undefined { return this.props.startedAt; }
  get completedAt(): Date | undefined { return this.props.completedAt; }

  // Business methods
  public addStep(stepType: string, metadata?: Record<string, any>): TacOperationStep {
    const step: TacOperationStep = {
      id: randomUUID(),
      stepType,
      stepOrder: this.props.steps!.length,
      stepName: this.getStepName(stepType),
      status: 'pending',
      metadata: metadata || {},
      startedAt: new Date()
    };

    this.props.steps!.push(step);
    this.markAsUpdated();

    return step;
  }

  public updateStep(stepId: string, updates: Partial<TacOperationStep>): void {
    const stepIndex = this.props.steps!.findIndex(step => step.id === stepId);

    if (stepIndex === -1) {
      throw new Error(`Step with id ${stepId} not found`);
    }

    this.props.steps![stepIndex] = {
      ...this.props.steps![stepIndex],
      ...updates,
      duration: updates.completedAt && this.props.steps![stepIndex].startedAt
        ? updates.completedAt.getTime() - this.props.steps![stepIndex].startedAt.getTime()
        : this.props.steps![stepIndex].duration
    };

    this.markAsUpdated();
  }

  public updateStatus(status: TacOperationStatus): void {
    const previousStatus = this.props.status;
    this.props.status = status;

    // Set timestamps based on status
    if (status === 'bridging_to_evm' && !this.props.startedAt) {
      this.props.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      this.props.completedAt = new Date();

      if (this.props.startedAt) {
        this.props.actualTime = this.props.completedAt.getTime() - this.props.startedAt.getTime();
      }
    }

    this.markAsUpdated();
  }

  public setError(errorMessage: string, errorCode?: string): void {
    this.props.errorMessage = errorMessage;
    this.props.errorCode = errorCode;
    this.props.status = 'failed';
    this.props.completedAt = new Date();
    this.markAsUpdated();
  }

  public incrementRetryCount(): void {
    this.props.retryCount = (this.props.retryCount || 0) + 1;
    this.props.lastRetryAt = new Date();

    // After 3 retries, disable further retries
    if (this.props.retryCount >= 3) {
      this.props.canRetry = false;
    }

    this.markAsUpdated();
  }

  public getCurrentStep(): TacOperationStep | undefined {
    return this.props.steps![this.props.currentStep!];
  }

  public getProgressPercentage(): number {
    if (this.props.steps!.length === 0) return 0;

    const completedSteps = this.props.steps!.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / this.props.steps!.length) * 100);
  }

  public getEstimatedCompletion(): Date | undefined {
    if (!this.props.estimatedTime || !this.props.startedAt) return undefined;

    return new Date(this.props.startedAt.getTime() + this.props.estimatedTime * 1000);
  }

  public isCompleted(): boolean {
    return this.props.status === 'completed' || this.props.status === 'failed';
  }

  public getDuration(): number | undefined {
    if (this.props.actualTime) return this.props.actualTime;

    if (this.props.startedAt && !this.isCompleted()) {
      return Date.now() - this.props.startedAt.getTime();
    }

    return undefined;
  }

  public toJSON(): TacOperationProps {
    return { ...this.props };
  }

  private validate(): void {
    if (!this.props.userId) {
      throw new Error('TacOperation: userId is required');
    }

    if (!this.props.operationType) {
      throw new Error('TacOperation: operationType is required');
    }

    if (!this.props.sourceChain || !this.props.targetChain) {
      throw new Error('TacOperation: sourceChain and targetChain are required');
    }

    if (!this.props.inputToken || !this.props.inputAmount) {
      throw new Error('TacOperation: inputToken and inputAmount are required');
    }

    // Validate amount is positive number
    const amount = parseFloat(this.props.inputAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('TacOperation: inputAmount must be a positive number');
    }
  }

  private markAsUpdated(): void {
    this.props.updatedAt = new Date();
  }

  private getStepName(stepType: string): string {
    const stepNames: Record<string, string> = {
      'bridge_to_target': 'Bridge to Target Chain',
      'bridge_to_evm': 'Bridge to EVM Chain',
      'target_chain_swap': 'Execute Target Chain Swap',
      'protocol_execution': 'Execute Protocol Operation',
      'bridge_back': 'Bridge Back to TON',
      'bridge_to_ton': 'Bridge Back to TON',
      'lido_stake': 'Stake with Lido',
      'benqi_supply': 'Supply to Benqi',
      'benqi_borrow': 'Borrow from Benqi',
      'swap_to_eth': 'Swap to ETH'
    };

    return stepNames[stepType] || stepType;
  }
}