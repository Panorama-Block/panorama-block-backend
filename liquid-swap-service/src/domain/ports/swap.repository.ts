// Domain Ports - Repository Interfaces
import { SwapRequest, SwapQuote, SwapResult, SwapTransaction } from "../entities/swap";

export interface ISwapRepository {
  saveSwapRequest(swapRequest: SwapRequest): Promise<void>;
  getSwapHistory(userAddress: string): Promise<SwapResult[]>;
  saveSwapResult(swapResult: SwapResult): Promise<void>;
  updateTransactionStatus(transactionHash: string, status: string): Promise<void>;
}

export interface IChainProvider {
  getProvider(chainId: number): any;
  getSigner(chainId: number): any;
  getRpcUrl(chainId: number): string;
  isChainSupported(chainId: number): boolean;
}

export interface ISwapService {
  getQuote(swapRequest: SwapRequest): Promise<SwapQuote>;
  prepareSwap(swapRequest: SwapRequest): Promise<any>;
  executeSwap(swapRequest: SwapRequest): Promise<SwapResult>;
  monitorTransaction(transactionHash: string, chainId: number): Promise<string>;
} 