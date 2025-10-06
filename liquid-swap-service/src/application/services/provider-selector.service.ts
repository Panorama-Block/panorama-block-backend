import { RouterDomainService } from '../../domain/services/router.domain.service';
import { SwapRequest, SwapQuote } from '../../domain/entities/swap';
import { PreparedSwap } from '../../domain/ports/swap.provider.port';

export class ProviderSelectorService {
  constructor(private readonly router: RouterDomainService) {}

  async getQuoteWithBestProvider(
    request: SwapRequest
  ): Promise<{ provider: string; quote: SwapQuote }> {
    const { provider, quote } = await this.router.selectBestProvider(request);

    return {
      provider: provider.name,
      quote
    };
  }

  async prepareSwapWithProvider(
    request: SwapRequest,
    preferredProvider?: string
  ): Promise<PreparedSwap> {
    // Se user especificou provider, validar se ele suporta a rota
    if (preferredProvider) {
      // TODO: Implementar seleção de provider específico
      console.log(`[ProviderSelector] User requested ${preferredProvider} provider`);
    }

    // Auto-select best provider
    const { provider } = await this.router.selectBestProvider(request);
    return provider.prepareSwap(request);
  }

  async getAvailableProviders(request: SwapRequest): Promise<string[]> {
    const routeParams = {
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken
    };

    // Esta funcionalidade pode ser útil para o frontend mostrar opções
    const availableProviders: string[] = [];

    // Aqui seria bom ter acesso direto aos providers, mas por enquanto
    // delegamos para o router que já faz essa verificação
    try {
      const { provider } = await this.router.selectBestProvider(request);
      availableProviders.push(provider.name);
    } catch (error) {
      console.log('[ProviderSelector] No providers available for route');
    }

    return availableProviders;
  }
}