import { TacOperation } from '../entities/TacOperation';

export interface BridgeRequest {
  from: {
    chain: string;
    token: string;
    amount: string;
    userWallet?: string;
  };
  to: {
    chain: string;
    token: string;
    userWallet?: string;
  };
  slippage?: number;
  deadline?: number; // timestamp
  metadata?: Record<string, any>;
}

export interface BridgeResponse {
  txHash: string;
  outputAmount: string;
  expectedOutput: string;
  provider: string;
  estimatedTime: number; // seconds
  fees: {
    bridge: string;
    gas: string;
    total: string;
  };
  bridgeId: string;
}

export interface BridgeStatus {
  bridgeId: string;
  txHash: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  isComplete: boolean;
  isFailed: boolean;
  outputAmount?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  error?: string;
  estimatedCompletion?: Date;
}

export interface BridgeQuote {
  provider: string;
  outputAmount: string;
  estimatedTime: number;
  fees: {
    bridge: string;
    gas: string;
    total: string;
  };
  priceImpact: number;
  confidence: number; // 0-1
  route: string[];
}

export interface ChainInfo {
  chainId: number;
  name: string;
  nativeCurrency: string;
  rpcUrl: string;
  explorerUrl: string;
  isActive: boolean;
  bridgeSupported: boolean;
}

export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  chainId: number;
  isNative: boolean;
  coingeckoId?: string;
  logoUri?: string;
}

export interface ITacBridgeService {
  // Bridge operations
  initiateBridge(request: BridgeRequest): Promise<BridgeResponse>;
  getBridgeStatus(bridgeId: string): Promise<BridgeStatus>;
  getBridgeQuote(request: BridgeRequest): Promise<BridgeQuote[]>;
  getBestQuote(request: BridgeRequest, preferences?: {
    prioritizeSpeed?: boolean;
    prioritizeCost?: boolean;
    minConfidence?: number;
  }): Promise<BridgeQuote>;

  // Chain and token info
  getSupportedChains(): Promise<ChainInfo[]>;
  getSupportedTokens(chainId?: number): Promise<TokenInfo[]>;
  getTokenInfo(symbol: string, chainId: number): Promise<TokenInfo | null>;
  isChainSupported(chainId: number): Promise<boolean>;
  isBridgeSupported(fromChainId: number, toChainId: number): Promise<boolean>;

  // Health and status
  isHealthy(): Promise<boolean>;
  getProviderStatus(): Promise<{
    provider: string;
    isHealthy: boolean;
    latency: number;
    lastChecked: Date;
  }[]>;

  // Event handling
  subscribeToOperation(operationId: string, callback: (update: BridgeUpdate) => void): Promise<void>;
  unsubscribeFromOperation(operationId: string): Promise<void>;
}

export interface BridgeUpdate {
  operationId: string;
  type: 'bridge_started' | 'bridge_confirmed' | 'bridge_completed' | 'bridge_failed';
  step: {
    stepId: string;
    stepType: string;
    status: string;
    transactionHash?: string;
    outputAmount?: string;
    blockNumber?: number;
    confirmations?: number;
  };
  timestamp: Date;
  metadata?: Record<string, any>;
}

// TAC-specific bridge service extending the base interface
export interface ITacSdkBridgeService extends ITacBridgeService {
  // TAC SDK specific methods
  initializeTacClient(config: {
    apiKey: string;
    endpoint: string;
    networks: string[];
  }): Promise<void>;

  // TON-specific operations
  bridgeFromTon(request: {
    tonWallet: string;
    fromToken: string;
    toChain: string;
    toToken: string;
    amount: string;
    slippage?: number;
  }): Promise<BridgeResponse>;

  bridgeToTon(request: {
    fromChain: string;
    fromToken: string;
    tonWallet: string;
    amount: string;
    slippage?: number;
  }): Promise<BridgeResponse>;

  // TAC transaction monitoring
  trackTacTransaction(tacTxId: string, operation: TacOperation): Promise<void>;
  getTacTransactionStatus(tacTxId: string): Promise<{
    status: string;
    steps: Array<{
      stepId: string;
      status: string;
      txHash?: string;
      completedAt?: Date;
    }>;
    isCompleted: boolean;
    isFailed: boolean;
    failureReason?: string;
  }>;

  // Batch operations
  executeBatchBridge(requests: BridgeRequest[]): Promise<BridgeResponse[]>;

  // Fee estimation
  estimateGasFees(request: BridgeRequest): Promise<{
    slow: string;
    standard: string;
    fast: string;
    estimated: string;
  }>;

  // Liquidity checks
  checkLiquidity(fromToken: string, toToken: string, amount: string): Promise<{
    isAvailable: boolean;
    maxAmount: string;
    currentLiquidity: string;
    providers: string[];
  }>;
}

// Protocol-specific bridge adapters
export interface IProtocolBridgeAdapter {
  getProtocolName(): string;
  getSupportedChains(): number[];
  getSupportedTokens(): string[];

  executeProtocolOperation(request: {
    operation: string; // 'stake', 'supply', 'borrow', 'swap'
    chain: string;
    token: string;
    amount: string;
    metadata?: Record<string, any>;
  }): Promise<{
    txHash: string;
    outputAmount: string;
    outputToken: string;
    gasUsed: string;
  }>;

  getProtocolQuote(request: {
    operation: string;
    chain: string;
    token: string;
    amount: string;
  }): Promise<{
    outputAmount: string;
    outputToken: string;
    fees: string;
    apy?: number;
    estimatedGas: string;
  }>;
}

// Bridge provider factory
export interface IBridgeProviderFactory {
  createTacBridgeService(): ITacSdkBridgeService;
  createLayerZeroBridgeService?(): ITacBridgeService;
  createAxelarBridgeService?(): ITacBridgeService;

  getAllProviders(): ITacBridgeService[];
  getHealthyProviders(): Promise<ITacBridgeService[]>;
  getBestProvider(criteria: {
    fromChain: string;
    toChain: string;
    prioritizeSpeed?: boolean;
    prioritizeCost?: boolean;
  }): Promise<ITacBridgeService>;
}