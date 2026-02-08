import { ILidoRepository } from '../../domain/interfaces/ILidoRepository';
import { LidoProtocolInfo, StakingPosition, StakingTransaction, WithdrawalRequest } from '../../domain/entities/StakingPosition';
import { PortfolioAsset, PortfolioMetricDaily } from '../../domain/entities/Portfolio';
import { Logger } from '../../infrastructure/logs/logger';
import { ethers } from 'ethers';

export class LidoService {
  constructor(
    private lidoRepository: ILidoRepository,
    private logger: Logger
  ) {}

  async stake(userAddress: string, amount: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Staking ${amount} ETH for user ${userAddress}`);
      
      // Validate inputs
      if (!userAddress || !amount) {
        throw new Error('User address and amount are required');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const transaction = await this.lidoRepository.stake(userAddress, amount);
      
      this.logger.info(`Staking transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Error staking: ${error}`);
      throw error;
    }
  }

  async unstake(userAddress: string, amount: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Unstaking ${amount} stETH for user ${userAddress}`);
      
      // Validate inputs
      if (!userAddress || !amount) {
        throw new Error('User address and amount are required');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Check if user has enough stETH
      const position = await this.lidoRepository.getStakingPosition(userAddress);
      if (!position) {
        throw new Error('Insufficient stETH balance');
      }

      const amountWei = ethers.utils.parseEther(amount);
      const stEthBalanceWei = ethers.BigNumber.from(position.stETHBalance || '0');

      if (stEthBalanceWei.lt(amountWei)) {
        throw new Error('Insufficient stETH balance (note: wstETH must be unwrapped or swapped first)');
      }

      const transaction = await this.lidoRepository.unstake(userAddress, amount);
      
      this.logger.info(`Unstaking transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Error unstaking: ${error}`);
      throw error;
    }
  }

  async claimRewards(userAddress: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Claiming rewards for user ${userAddress}`);
      
      if (!userAddress) {
        throw new Error('User address is required');
      }

      const transaction = await this.lidoRepository.claimRewards(userAddress);
      
      this.logger.info(`Claim rewards transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Error claiming rewards: ${error}`);
      throw error;
    }
  }

  async getStakingPosition(userAddress: string): Promise<StakingPosition | null> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }

      return await this.lidoRepository.getStakingPosition(userAddress);
    } catch (error) {
      this.logger.error(`Error getting staking position: ${error}`);
      throw error;
    }
  }

  async getStakingHistory(userAddress: string, limit: number = 50): Promise<StakingTransaction[]> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }

      return await this.lidoRepository.getStakingHistory(userAddress, limit);
    } catch (error) {
      this.logger.error(`Error getting staking history: ${error}`);
      throw error;
    }
  }

  async getWithdrawalRequests(userAddress: string): Promise<WithdrawalRequest[]> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }
      return await this.lidoRepository.getWithdrawalRequests(userAddress);
    } catch (error) {
      this.logger.error(`Error getting withdrawal requests: ${error}`);
      throw error;
    }
  }

  async claimWithdrawals(userAddress: string, requestIds: string[]): Promise<StakingTransaction> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }
      if (!requestIds?.length) {
        throw new Error('requestIds is required');
      }
      return await this.lidoRepository.claimWithdrawals(userAddress, requestIds);
    } catch (error) {
      this.logger.error(`Error claiming withdrawals: ${error}`);
      throw error;
    }
  }

  async submitTransactionHash(transactionId: string, userAddress: string, transactionHash: string): Promise<void> {
    try {
      if (!transactionId) throw new Error('transactionId is required');
      if (!userAddress) throw new Error('userAddress is required');
      if (!transactionHash) throw new Error('transactionHash is required');
      await this.lidoRepository.submitTransactionHash(transactionId, userAddress, transactionHash);
    } catch (error) {
      this.logger.error(`Error submitting transaction hash: ${error}`);
      throw error;
    }
  }

  async getProtocolInfo(): Promise<LidoProtocolInfo> {
    try {
      return await this.lidoRepository.getProtocolInfo();
    } catch (error) {
      this.logger.error(`Error getting protocol info: ${error}`);
      throw error;
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null> {
    try {
      if (!transactionHash) {
        throw new Error('Transaction hash is required');
      }

      return await this.lidoRepository.getTransactionStatus(transactionHash);
    } catch (error) {
      this.logger.error(`Error getting transaction status: ${error}`);
      throw error;
    }
  }

  async getPortfolioAssets(userAddress: string): Promise<PortfolioAsset[]> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }
      return await this.lidoRepository.getPortfolioAssets(userAddress);
    } catch (error) {
      this.logger.error(`Error getting portfolio assets: ${error}`);
      throw error;
    }
  }

  async getPortfolioDailyMetrics(userAddress: string, days: number = 30): Promise<PortfolioMetricDaily[]> {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }
      return await this.lidoRepository.getPortfolioDailyMetrics(userAddress, days);
    } catch (error) {
      this.logger.error(`Error getting portfolio daily metrics: ${error}`);
      throw error;
    }
  }
}
