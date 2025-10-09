// Port genérico para qualquer provider (Uniswap, Thirdweb, etc.)
import { SwapRequest, SwapQuote } from '../entities/swap';

export interface ISwapProvider {
  readonly name: string; // 'uniswap' | 'thirdweb'

  // Check if provider supports this route
  supportsRoute(params: RouteParams): Promise<boolean>;

  // Get quote
  getQuote(request: SwapRequest): Promise<SwapQuote>;

  // Prepare transaction
  prepareSwap(request: SwapRequest): Promise<PreparedSwap>;

  // Monitor transaction
  monitorTransaction(txHash: string, chainId: number): Promise<string>;
}

export interface RouteParams {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
}

export interface PreparedSwap {
  provider: string;
  transactions: Transaction[];
  estimatedDuration: number;
  expiresAt?: Date;
}

export interface Transaction {
  chainId: number;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
}