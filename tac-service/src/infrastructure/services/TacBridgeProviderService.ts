import {
  IBridgeProviderService,
  BridgeProviderInfo,
  ProviderQuoteRequest,
  ProviderQuote
} from '../../domain/interfaces/IBridgeProviderService';
import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';

export class TacBridgeProviderService implements IBridgeProviderService {
  constructor(
    private readonly repository: ITacRepository,
    private readonly analytics: ITacAnalyticsService
  ) {}

  async getActiveProviders(_fromChain: string, _toChain: string, _tokens?: string[]): Promise<BridgeProviderInfo[]> {
    const providers = await this.repository.findBridgeProviders(true);
    if (providers.length === 0) {
      // Fallback to TAC if DB empty
      return [{
        id: 'tac',
        name: 'tac',
        displayName: 'Technology Adapter Chain',
        isActive: true,
        isHealthy: true,
        supportedChains: ['ton', 'ethereum', 'avalanche', 'base'],
        supportedTokens: [],
        metadata: {}
      }];
    }
    return providers.map(p => ({
      ...p,
      metadata: {}
    }));
  }

  async getQuote(providerName: string, request: ProviderQuoteRequest): Promise<ProviderQuote> {
    // Simple heuristic quote until provider-specific adapters are implemented
    const fee = request.amount * 0.0025;
    const estimatedOutput = request.amount - fee;

    return {
      provider: providerName,
      estimatedOutput,
      estimatedTime: 120,
      fees: fee,
      priceImpact: 0.5,
      confidence: 85,
      steps: [
        { protocol: 'bridge', action: 'bridge_to_evm' },
        { protocol: 'dex', action: 'swap' },
        { protocol: 'bridge', action: 'bridge_to_ton' }
      ],
      tradeOffs: ['Provider integration placeholder'],
      metadata: { providerName }
    };
  }

  async recordProviderHealth(_providerName: string, _isHealthy: boolean, _latencyMs?: number): Promise<void> {
    await this.repository.updateBridgeProviderHealth(_providerName, _isHealthy, _latencyMs);
  }
}
