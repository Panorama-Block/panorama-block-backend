import { ethers } from 'ethers';
import { Logger } from '../logs/logger';

export class EthereumConfig {
  private static instance: EthereumConfig;
  private provider!: ethers.providers.JsonRpcProvider;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger();
    this.initializeProvider();
  }

  public static getInstance(): EthereumConfig {
    if (!EthereumConfig.instance) {
      EthereumConfig.instance = new EthereumConfig();
    }
    return EthereumConfig.instance;
  }

  private initializeProvider(): void {
    try {
      const rpcUrl = process.env.ETHEREUM_RPC_URL;
      if (!rpcUrl) {
        throw new Error('ETHEREUM_RPC_URL environment variable is required');
      }

      // Create provider with explicit network configuration
      this.provider = new ethers.providers.JsonRpcProvider({
        url: rpcUrl,
        name: 'mainnet',
        chainId: 1
      });
      
      this.logger.info('Ethereum provider initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Ethereum provider: ${error}`);
      throw error;
    }
  }

  public getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider;
  }

  public getSigner(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.provider);
  }

  public getChainId(): number {
    return parseInt(process.env.ETHEREUM_CHAIN_ID || '1');
  }
}
