import { TacOperation } from '../entities/TacOperation';
import { CrossChainQuote } from '../entities/CrossChainQuote';

export type DashboardTimeframe = '24h' | '7d' | '30d' | '90d';

export interface OperationMetrics {
  totalOperations: number;
  totalVolumeUSD: number;
  successRate: number;
  averageCompletionTime: number;
  topProtocols: Array<{ protocol: string; volumeUSD: number; operations: number }>;
  chainDistribution: Array<{ chain: string; volumeUSD: number; percentage: number }>;
}

export interface UserInsights {
  totalOperations: number;
  totalVolumeUSD: number;
  favoriteProtocols: string[];
  averageOperationSizeUSD: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  recommendedProtocols: string[];
}

export interface ITacAnalyticsService {
  trackOperationCreated(operation: TacOperation): Promise<void>;
  trackOperationCompleted(operation: TacOperation): Promise<void>;
  trackOperationFailed(operation: TacOperation, reason: string): Promise<void>;
  trackQuoteGenerated(quote: CrossChainQuote): Promise<void>;

  getDashboardMetrics(timeframe: DashboardTimeframe): Promise<OperationMetrics>;
  getUserInsights(userId: string): Promise<UserInsights>;
}
