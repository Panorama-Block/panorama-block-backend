import { LidoProtocolInfo, StakingPosition, StakingTransaction, WithdrawalRequest } from '../entities/StakingPosition';
import { PortfolioAsset, PortfolioMetricDaily } from '../entities/Portfolio';

export interface ILidoRepository {
  // Staking operations
  stake(userAddress: string, amount: string): Promise<StakingTransaction>;
  unstake(userAddress: string, amount: string): Promise<StakingTransaction>;
  claimRewards(userAddress: string): Promise<StakingTransaction>;
  
  // Position queries
  getStakingPosition(userAddress: string): Promise<StakingPosition | null>;
  getStakingHistory(userAddress: string, limit?: number): Promise<StakingTransaction[]>;

  // Withdrawal Queue (unstake completion)
  getWithdrawalRequests(userAddress: string): Promise<WithdrawalRequest[]>;
  claimWithdrawals(userAddress: string, requestIds: string[]): Promise<StakingTransaction>;
  submitTransactionHash(transactionId: string, userAddress: string, transactionHash: string): Promise<void>;
  
  // Protocol information
  getProtocolInfo(): Promise<LidoProtocolInfo>;
  getCurrentAPY(): Promise<number | null>;
  
  // Transaction status
  getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null>;
  updateTransactionStatus(transactionHash: string, status: 'pending' | 'completed' | 'failed'): Promise<void>;

  // Portfolio (requires persistence for historical metrics)
  getPortfolioAssets(userAddress: string): Promise<PortfolioAsset[]>;
  getPortfolioDailyMetrics(userAddress: string, days: number): Promise<PortfolioMetricDaily[]>;
}
