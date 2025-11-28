export interface BridgeProviderInfo {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  isHealthy: boolean;
  supportedChains: string[];
  supportedTokens: string[];
  metadata?: Record<string, any>;
}

export interface ProviderQuoteRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: number;
  slippage?: number;
}

export interface ProviderQuote {
  provider: string;
  estimatedOutput: number;
  estimatedTime: number;
  fees: number;
  priceImpact?: number;
  confidence?: number;
  steps?: Array<{
    protocol: string;
    action: string;
    chain?: string;
  }>;
  metadata?: Record<string, any>;
  tradeOffs?: string[];
}

export interface IBridgeProviderService {
  getActiveProviders(fromChain: string, toChain: string, tokens?: string[]): Promise<BridgeProviderInfo[]>;
  getQuote(providerName: string, request: ProviderQuoteRequest): Promise<ProviderQuote>;
  recordProviderHealth(providerName: string, isHealthy: boolean, latencyMs?: number): Promise<void>;
  refreshProvidersCache?(): Promise<void>;
}
