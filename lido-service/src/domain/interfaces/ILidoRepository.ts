import { StakingPosition, StakingTransaction, LidoProtocolInfo } from '../entities/StakingPosition';

export interface ILidoRepository {
  // Staking operations
  stake(userAddress: string, amount: string): Promise<StakingTransaction>;
  unstake(userAddress: string, amount: string): Promise<StakingTransaction>;
  claimRewards(userAddress: string): Promise<StakingTransaction>;
  
  // Position queries
  getStakingPosition(userAddress: string): Promise<StakingPosition | null>;
  getStakingHistory(userAddress: string, limit?: number): Promise<StakingTransaction[]>;
  
  // Protocol information
  getProtocolInfo(): Promise<LidoProtocolInfo>;
  getCurrentAPY(): Promise<number>;
  getStETHPrice(): Promise<string>;
  getWstETHPrice(): Promise<string>;
  
  // Transaction status
  getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null>;
  updateTransactionStatus(transactionHash: string, status: 'pending' | 'completed' | 'failed'): Promise<void>;
}
