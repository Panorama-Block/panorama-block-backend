import { TacOperation, TacOperationStatus, TacOperationType } from '../entities/TacOperation';
import { CrossChainQuote } from '../entities/CrossChainQuote';
import { TacBalance } from '../entities/TacBalance';

export interface ITacOperationRepository {
  // TacOperation CRUD operations
  save(operation: TacOperation): Promise<void>;
  findById(id: string): Promise<TacOperation | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<TacOperation[]>;
  findByStatus(status: TacOperationStatus): Promise<TacOperation[]>;
  findByTacTransactionId(tacTransactionId: string): Promise<TacOperation | null>;
  findPendingOperations(): Promise<TacOperation[]>;
  findRecentOperations(timeframeHours: number): Promise<TacOperation[]>;
  findOperationsByDateRange(startDate: Date, endDate: Date): Promise<TacOperation[]>;
  update(operation: TacOperation): Promise<void>;
  delete(id: string): Promise<void>;

  // Analytics and reporting
  getOperationMetrics(timeframe: string): Promise<{
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageCompletionTime: number;
    totalVolume: string;
  }>;

  getUserOperationStats(userId: string): Promise<{
    totalOperations: number;
    successRate: number;
    totalVolume: string;
    favoriteProtocols: string[];
    averageOperationSize: string;
  }>;
}

export interface ICrossChainQuoteRepository {
  // Quote CRUD operations
  save(quote: CrossChainQuote): Promise<void>;
  findById(id: string): Promise<CrossChainQuote | null>;
  findByUserId(userId: string, limit?: number): Promise<CrossChainQuote[]>;
  findActiveQuotes(): Promise<CrossChainQuote[]>;
  findExpiredQuotes(): Promise<CrossChainQuote[]>;
  update(quote: CrossChainQuote): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpiredQuotes(): Promise<number>; // Returns number of deleted quotes

  // Quote analytics
  getQuoteMetrics(timeframe: string): Promise<{
    totalQuotes: number;
    executedQuotes: number;
    averageSlippage: number;
    popularRoutes: Array<{
      fromChain: string;
      toChain: string;
      fromToken: string;
      toToken: string;
      count: number;
    }>;
  }>;
}

export interface ITacBalanceRepository {
  // Balance CRUD operations
  save(balance: TacBalance): Promise<void>;
  findById(id: string): Promise<TacBalance | null>;
  findByUserId(userId: string): Promise<TacBalance[]>;
  findByUserIdAndToken(userId: string, tokenSymbol: string): Promise<TacBalance | null>;
  findByProtocol(protocol: string): Promise<TacBalance[]>;
  findByChain(chain: string): Promise<TacBalance[]>;
  findActiveBalances(): Promise<TacBalance[]>;
  findBalancesNeedingSync(maxAgeMs: number): Promise<TacBalance[]>;
  update(balance: TacBalance): Promise<void>;
  delete(id: string): Promise<void>;

  // Balance aggregation
  getUserPortfolioValue(userId: string): Promise<{
    totalValueUSD: string;
    balancesByProtocol: Array<{
      protocol: string;
      totalValue: string;
      positions: number;
    }>;
    totalRewardsEarned: string;
    totalClaimableRewards: string;
  }>;

  getTotalValueLocked(): Promise<{
    totalUSD: string;
    byProtocol: Array<{
      protocol: string;
      tvl: string;
    }>;
    byChain: Array<{
      chain: string;
      tvl: string;
    }>;
  }>;
}

export interface ITacAnalyticsRepository {
  // Analytics data storage
  recordOperation(data: {
    operationType: string;
    sourceChain: string;
    targetChain: string;
    protocol?: string;
    volumeUSD: number;
    feesPaidUSD: number;
    success: boolean;
    durationSeconds: number;
    userId: string;
  }): Promise<void>;

  recordQuote(data: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    amount: string;
    executed: boolean;
    userId: string;
  }): Promise<void>;

  recordUserBehavior(data: {
    userId: string;
    action: string;
    metadata: Record<string, any>;
  }): Promise<void>;

  // Analytics queries
  getDashboardMetrics(timeframe: string): Promise<{
    totalOperations: number;
    totalVolume: number;
    successRate: number;
    averageCompletionTime: number;
    topProtocols: Array<{
      protocol: string;
      volume: number;
      operations: number;
    }>;
    chainDistribution: Array<{
      chain: string;
      volume: number;
      percentage: number;
    }>;
    userRetention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  }>;

  getUserInsights(userId: string): Promise<{
    totalOperations: number;
    totalVolumeUSD: number;
    favoriteProtocols: string[];
    averageOperationSize: number;
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
    recommendedProtocols: string[];
  }>;
}

// Base repository interface with common operations
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  count(): Promise<number>;
}

// Transaction management
export interface ITransactionManager {
  executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Repository factory for dependency injection
export interface IRepositoryFactory {
  createTacOperationRepository(): ITacOperationRepository;
  createCrossChainQuoteRepository(): ICrossChainQuoteRepository;
  createTacBalanceRepository(): ITacBalanceRepository;
  createTacAnalyticsRepository(): ITacAnalyticsRepository;
  createTransactionManager(): ITransactionManager;
}