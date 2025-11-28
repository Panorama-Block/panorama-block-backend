import { TacOperation, TacOperationStatus, TacOperationType } from '../entities/TacOperation';
import { CrossChainQuote } from '../entities/CrossChainQuote';
import { TacBalance } from '../entities/TacBalance';

export interface OperationSearchFilters {
  userId?: string;
  status?: TacOperationStatus;
  operationType?: TacOperationType;
  sourceChain?: string;
  targetChain?: string;
  protocol?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface QuoteSearchFilters {
  userId?: string;
  includeExpired?: boolean;
  limit?: number;
}

export interface BalancePortfolioBreakdown {
  totalValueUSD: string;
  balancesByProtocol: Array<{ protocol: string; totalValue: string; positions: number }>;
  totalRewardsEarned: string;
  totalClaimableRewards: string;
}

export interface TotalValueLockedBreakdown {
  totalUSD: string;
  byProtocol: Array<{ protocol: string; tvl: string }>;
  byChain: Array<{ chain: string; tvl: string }>;
}

export interface ITacRepository {
  // Operations
  saveOperation(operation: TacOperation): Promise<TacOperation>;
  updateOperation(operation: TacOperation): Promise<TacOperation>;
  deleteOperation(id: string): Promise<void>;
  findOperationById(id: string): Promise<TacOperation | null>;
  findOperations(filters: OperationSearchFilters, limit?: number, offset?: number): Promise<TacOperation[]>;
  findPendingOperations(limit?: number): Promise<TacOperation[]>;
  findRecentOperations(timeframeHours: number): Promise<TacOperation[]>;
  findOperationsByStatus(status: TacOperationStatus, limit?: number): Promise<TacOperation[]>;
  getOperationMetrics(timeframe: '24h' | '7d' | '30d'): Promise<{
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

  // Quotes
  saveQuote(quote: CrossChainQuote): Promise<CrossChainQuote>;
  updateQuote(quote: CrossChainQuote): Promise<CrossChainQuote>;
  deleteQuote(id: string): Promise<void>;
  findQuoteById(id: string): Promise<CrossChainQuote | null>;
  findUserQuotes(userId: string, includeExpired?: boolean, limit?: number): Promise<CrossChainQuote[]>;
  findActiveQuotes(limit?: number): Promise<CrossChainQuote[]>;
  deleteExpiredQuotes(maxAgeMs?: number): Promise<number>;

  // Balances
  saveBalance(balance: TacBalance): Promise<TacBalance>;
  updateBalance(balance: TacBalance): Promise<TacBalance>;
  deleteBalance(id: string): Promise<void>;
  findBalanceById(id: string): Promise<TacBalance | null>;
  findUserBalances(userId: string): Promise<TacBalance[]>;
  findActiveBalances(): Promise<TacBalance[]>;
  findBalancesNeedingSync(maxAgeMs: number): Promise<TacBalance[]>;
  getUserPortfolioValue(userId: string): Promise<BalancePortfolioBreakdown>;
  getTotalValueLocked(): Promise<TotalValueLockedBreakdown>;

  // Bridge providers
  findBridgeProviders(activeOnly?: boolean): Promise<Array<{
    id: string;
    name: string;
    displayName: string;
    isActive: boolean;
    isHealthy: boolean;
    supportedChains: string[];
    supportedTokens: string[];
    endpoint: string;
    apiKey?: string | null;
    averageLatency?: number | null;
    successRate?: string | null;
  }>>;
  updateBridgeProviderHealth(providerName: string, isHealthy: boolean, latencyMs?: number): Promise<void>;

  // Configuration
  getUserConfiguration(userId: string): Promise<any | null>;
  saveUserConfiguration(userId: string, config: any): Promise<any>;
  updateUserConfiguration(userId: string, config: any): Promise<any>;

  // Notifications
  saveNotification(notification: any): Promise<void>;
  getPendingNotifications(limit?: number): Promise<any[]>;
  markNotificationSent(notificationId: string, meta?: Record<string, any>): Promise<void>;

  // Events
  saveEvent(event: any): Promise<void>;
  getUnprocessedEvents(limit?: number): Promise<any[]>;
  markEventProcessed(eventId: string): Promise<void>;

  // Cleanup helpers
  pruneHistoricalData(options: {
    expiredQuoteRetentionMs: number;
    analyticsRetentionMs: number;
    eventRetentionMs: number;
    notificationRetentionMs: number;
  }): Promise<void>;
}
