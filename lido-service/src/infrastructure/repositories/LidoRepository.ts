import { ethers } from 'ethers';
import { ILidoRepository } from '../../domain/interfaces/ILidoRepository';
import { StakingPosition, StakingTransaction, LidoProtocolInfo } from '../../domain/entities/StakingPosition';
import { EthereumConfig } from '../config/ethereum';
import { LIDO_CONTRACTS, STETH_ABI, WSTETH_ABI, WITHDRAWAL_QUEUE_ABI } from '../config/lidoContracts';
import { Logger } from '../logs/logger';

export class LidoRepository implements ILidoRepository {
  private ethereumConfig: EthereumConfig;
  private logger: Logger;
  private stETHContract!: ethers.Contract;
  private wstETHContract!: ethers.Contract;
  private withdrawalQueueContract!: ethers.Contract;

  constructor() {
    this.ethereumConfig = EthereumConfig.getInstance();
    this.logger = new Logger();
    this.initializeContracts();
  }

  private initializeContracts(): void {
    try {
      const provider = this.ethereumConfig.getProvider();
      
      this.stETHContract = new ethers.Contract(
        LIDO_CONTRACTS.STETH,
        STETH_ABI,
        provider
      );

      this.wstETHContract = new ethers.Contract(
        LIDO_CONTRACTS.WSTETH,
        WSTETH_ABI,
        provider
      );

      this.withdrawalQueueContract = new ethers.Contract(
        LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
        WITHDRAWAL_QUEUE_ABI,
        provider
      );

      this.logger.info('Lido contracts initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Lido contracts: ${error}`);
      throw error;
    }
  }

  async stake(userAddress: string, amount: string, privateKey?: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating stake transaction for ${userAddress} with amount ${amount}`);
      
      const transactionId = this.generateTransactionId();
      const amountWei = ethers.utils.parseEther(amount);
      
      let transaction: StakingTransaction;
      
      if (privateKey) {
        // Execute real transaction with private key
        this.logger.info('Executing real stake transaction with private key');
        
        const signer = this.ethereumConfig.getSigner(privateKey);
        const stETHContract = new ethers.Contract(
          LIDO_CONTRACTS.STETH,
          STETH_ABI,
          signer
        );
        
        // Submit ETH to Lido staking contract
        const tx = await stETHContract.submit({
          value: amountWei,
          gasLimit: 200000 // Estimated gas limit for submit
        });
        
        this.logger.info(`Stake transaction submitted: ${tx.hash}`);
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'stake',
          amount,
          token: 'ETH',
          status: receipt.status === 1 ? 'completed' : 'failed',
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: new Date()
        };
        
        this.logger.info(`Stake transaction completed: ${tx.hash}`);
      } else {
        // Return transaction data for frontend signing (smart wallet)
        this.logger.info('Preparing stake transaction for frontend signing');
        
        const stETHContract = new ethers.Contract(
          LIDO_CONTRACTS.STETH,
          STETH_ABI,
          this.ethereumConfig.getProvider()
        );
        
        // Get transaction data for frontend to sign
        const txData = await stETHContract.populateTransaction.submit({
          value: amountWei
        });
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'stake',
          amount,
          token: 'ETH',
          status: 'pending',
          transactionData: {
            to: txData.to || LIDO_CONTRACTS.STETH,
            data: txData.data || '0x',
            value: txData.value?.toString() || '0',
            gasLimit: '200000',
            chainId: this.ethereumConfig.getChainId()
          },
          timestamp: new Date()
        };
        
        this.logger.info(`Stake transaction prepared for signing: ${transactionId}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating stake transaction: ${error}`);
      throw error;
    }
  }

  async unstake(userAddress: string, amount: string, privateKey?: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating unstake transaction for ${userAddress} with amount ${amount}`);
      
      const transactionId = this.generateTransactionId();
      const amountWei = ethers.utils.parseEther(amount);
      
      let transaction: StakingTransaction;
      
      if (privateKey) {
        // Execute real transaction with private key
        this.logger.info('Executing real unstake transaction with private key');
        
        const signer = this.ethereumConfig.getSigner(privateKey);
        const withdrawalQueueContract = new ethers.Contract(
          LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
          WITHDRAWAL_QUEUE_ABI,
          signer
        );
        
        // Request withdrawal from Lido
        const tx = await withdrawalQueueContract.requestWithdrawals(
          [amountWei],
          userAddress,
          {
            gasLimit: 300000 // Estimated gas limit for withdrawal request
          }
        );
        
        this.logger.info(`Unstake transaction submitted: ${tx.hash}`);
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'unstake',
          amount,
          token: 'stETH',
          status: receipt.status === 1 ? 'completed' : 'failed',
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: new Date()
        };
        
        this.logger.info(`Unstake transaction completed: ${tx.hash}`);
      } else {
        // Return transaction data for frontend signing (smart wallet)
        this.logger.info('Preparing unstake transaction for frontend signing');
        
        const withdrawalQueueContract = new ethers.Contract(
          LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
          WITHDRAWAL_QUEUE_ABI,
          this.ethereumConfig.getProvider()
        );
        
        // Get transaction data for frontend to sign
        const txData = await withdrawalQueueContract.populateTransaction.requestWithdrawals(
          [amountWei],
          userAddress
        );
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'unstake',
          amount,
          token: 'stETH',
          status: 'pending',
          transactionData: {
            to: txData.to || LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
            data: txData.data || '0x',
            value: '0',
            gasLimit: '300000',
            chainId: this.ethereumConfig.getChainId()
          },
          timestamp: new Date()
        };
        
        this.logger.info(`Unstake transaction prepared for signing: ${transactionId}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating unstake transaction: ${error}`);
      throw error;
    }
  }

  async claimRewards(userAddress: string, privateKey?: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating claim rewards transaction for ${userAddress}`);
      
      const transactionId = this.generateTransactionId();
      
      let transaction: StakingTransaction;
      
      if (privateKey) {
        // Execute real transaction with private key
        this.logger.info('Executing real claim rewards transaction with private key');
        
        const signer = this.ethereumConfig.getSigner(privateKey);
        const stETHContract = new ethers.Contract(
          LIDO_CONTRACTS.STETH,
          STETH_ABI,
          signer
        );
        
        // In Lido, rewards are automatically added to stETH balance
        // We can trigger a transfer to self to update the balance
        const tx = await stETHContract.transfer(userAddress, 0, {
          gasLimit: 100000
        });
        
        this.logger.info(`Claim rewards transaction submitted: ${tx.hash}`);
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'claim_rewards',
          amount: '0',
          token: 'stETH',
          status: receipt.status === 1 ? 'completed' : 'failed',
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: new Date()
        };
        
        this.logger.info(`Claim rewards transaction completed: ${tx.hash}`);
      } else {
        // Return transaction data for frontend signing (smart wallet)
        this.logger.info('Preparing claim rewards transaction for frontend signing');
        
        const stETHContract = new ethers.Contract(
          LIDO_CONTRACTS.STETH,
          STETH_ABI,
          this.ethereumConfig.getProvider()
        );
        
        // Get transaction data for frontend to sign
        const txData = await stETHContract.populateTransaction.transfer(userAddress, 0);
        
        transaction = {
          id: transactionId,
          userAddress,
          type: 'claim_rewards',
          amount: '0',
          token: 'stETH',
          status: 'pending',
          transactionData: {
            to: txData.to || LIDO_CONTRACTS.STETH,
            data: txData.data || '0x',
            value: '0',
            gasLimit: '100000',
            chainId: this.ethereumConfig.getChainId()
          },
          timestamp: new Date()
        };
        
        this.logger.info(`Claim rewards transaction prepared for signing: ${transactionId}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating claim rewards transaction: ${error}`);
      throw error;
    }
  }

  async getStakingPosition(userAddress: string): Promise<StakingPosition | null> {
    try {
      this.logger.info(`Getting staking position for ${userAddress}`);
      
      // Normalize address to proper checksum
      const normalizedAddress = ethers.utils.getAddress(userAddress);
      
      // Get stETH balance
      const stETHBalance = await this.stETHContract.balanceOf(normalizedAddress);
      const stETHBalanceFormatted = ethers.utils.formatEther(stETHBalance);
      
      // Get wstETH balance
      const wstETHBalance = await this.wstETHContract.balanceOf(normalizedAddress);
      const wstETHBalanceFormatted = ethers.utils.formatEther(wstETHBalance);
      
      // Get protocol info for APY
      const protocolInfo = await this.getProtocolInfo();
      
      // Calculate total staked amount (stETH + wstETH equivalent)
      const totalStaked = (parseFloat(stETHBalanceFormatted) + parseFloat(wstETHBalanceFormatted)).toString();
      
      if (parseFloat(totalStaked) === 0) {
        return null;
      }

      const position: StakingPosition = {
        id: this.generatePositionId(userAddress),
        userAddress,
        stakedAmount: totalStaked,
        stETHBalance: stETHBalanceFormatted,
        wstETHBalance: wstETHBalanceFormatted,
        rewards: '0', // This would be calculated based on staking duration
        apy: protocolInfo.currentAPY,
        timestamp: new Date(),
        status: 'active'
      };

      this.logger.info(`Staking position retrieved for ${userAddress}`);
      return position;
    } catch (error) {
      this.logger.error(`Error getting staking position: ${error}`);
      throw error;
    }
  }

  async getStakingHistory(userAddress: string, limit: number = 50): Promise<StakingTransaction[]> {
    try {
      this.logger.info(`Getting staking history for ${userAddress} with limit ${limit}`);
      
      // In a real implementation, this would query a database or blockchain events
      // For now, return empty array
      return [];
    } catch (error) {
      this.logger.error(`Error getting staking history: ${error}`);
      throw error;
    }
  }

  async getProtocolInfo(): Promise<LidoProtocolInfo> {
    try {
      this.logger.info('Getting Lido protocol information');
      
      // Get total staked ETH
      const totalPooledEther = await this.stETHContract.getTotalPooledEther();
      const totalStaked = ethers.utils.formatEther(totalPooledEther);
      
      // Get total supply of stETH
      const totalSupply = await this.stETHContract.totalSupply();
      const totalSupplyFormatted = ethers.utils.formatEther(totalSupply);
      
      // Calculate current APY (simplified calculation)
      const currentAPY = await this.getCurrentAPY();
      
      // Get stETH price (1:1 with ETH in normal conditions)
      const stETHPrice = '1.0'; // This would be fetched from an oracle in production
      const wstETHPrice = '1.0'; // This would be calculated based on exchange rate
      
      const protocolInfo: LidoProtocolInfo = {
        totalStaked,
        totalRewards: '0', // This would be calculated from protocol rewards
        currentAPY,
        stETHPrice,
        wstETHPrice,
        lastUpdate: new Date()
      };

      this.logger.info('Protocol information retrieved successfully');
      return protocolInfo;
    } catch (error) {
      this.logger.error(`Error getting protocol info: ${error}`);
      throw error;
    }
  }

  async getCurrentAPY(): Promise<number> {
    try {
      // In a real implementation, this would fetch from Lido's API or calculate from on-chain data
      // For now, return a mock APY
      return 4.5; // 4.5% APY
    } catch (error) {
      this.logger.error(`Error getting current APY: ${error}`);
      throw error;
    }
  }

  async getStETHPrice(): Promise<string> {
    try {
      // In a real implementation, this would fetch from a price oracle
      return '1.0';
    } catch (error) {
      this.logger.error(`Error getting stETH price: ${error}`);
      throw error;
    }
  }

  async getWstETHPrice(): Promise<string> {
    try {
      // In a real implementation, this would calculate based on stETH exchange rate
      return '1.0';
    } catch (error) {
      this.logger.error(`Error getting wstETH price: ${error}`);
      throw error;
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null> {
    try {
      this.logger.info(`Getting transaction status for ${transactionHash}`);
      
      // In a real implementation, this would query the blockchain or database
      // For now, return null
      return null;
    } catch (error) {
      this.logger.error(`Error getting transaction status: ${error}`);
      throw error;
    }
  }

  async updateTransactionStatus(transactionHash: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    try {
      this.logger.info(`Updating transaction status for ${transactionHash} to ${status}`);
      
      // In a real implementation, this would update the database
      // For now, just log the action
    } catch (error) {
      this.logger.error(`Error updating transaction status: ${error}`);
      throw error;
    }
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePositionId(userAddress: string): string {
    return `pos_${userAddress.slice(0, 8)}_${Date.now()}`;
  }
}
