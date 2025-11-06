import { ILidoRepository } from '../../domain/interfaces/ILidoRepository';
import { StakingPosition, StakingTransaction, LidoProtocolInfo } from '../../domain/entities/StakingPosition';
import { Logger } from '../../infrastructure/logs/logger';

export class LidoService {
  constructor(
    private lidoRepository: ILidoRepository,
    private logger: Logger
  ) {}

  async stake(userAddress: string, amount: string, privateKey?: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Staking ${amount} ETH for user ${userAddress}`);
      
      // Validate inputs
      if (!userAddress || !amount) {
        throw new Error('User address and amount are required');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const transaction = await this.lidoRepository.stake(userAddress, amount, privateKey);
      
      this.logger.info(`Staking transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Error staking: ${error}`);
      throw error;
    }
  }

  async unstake(userAddress: string, amount: string, privateKey?: string): Promise<StakingTransaction> {
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
      if (!position || parseFloat(position.stETHBalance) < parseFloat(amount)) {
        throw new Error('Insufficient stETH balance');
      }

      const transaction = await this.lidoRepository.unstake(userAddress, amount, privateKey);
      
      this.logger.info(`Unstaking transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Error unstaking: ${error}`);
      throw error;
    }
  }

  async claimRewards(userAddress: string, privateKey?: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Claiming rewards for user ${userAddress}`);
      
      if (!userAddress) {
        throw new Error('User address is required');
      }

      const transaction = await this.lidoRepository.claimRewards(userAddress, privateKey);
      
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
}
