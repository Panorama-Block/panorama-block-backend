import { ISwapProvider, RouteParams } from '../ports/swap.provider.port';
import { SwapRequest, SwapQuote } from '../entities/swap';

/**
 * RouterDomainService
 *
 * Responsável pela lógica de seleção de providers.
 *
 * Estratégia:
 * 1. Same-chain → Uniswap (melhor liquidez)
 * 2. Cross-chain → Thirdweb (especializado em bridges)
 * 3. Fallback automático se provider falhar
 */
export class RouterDomainService {
  constructor(
    private readonly providers: Map<string, ISwapProvider>
  ) {}

  async selectBestProvider(
    request: SwapRequest
  ): Promise<{ provider: ISwapProvider; quote: SwapQuote }> {
    const routeParams: RouteParams = {
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken
    };

    // 1. Check which providers support this route
    const supportedProviders: ISwapProvider[] = [];

    for (const [name, provider] of this.providers) {
      try {
        const supports = await provider.supportsRoute(routeParams);
        if (supports) {
          supportedProviders.push(provider);
        }
      } catch (error) {
        console.error(`[Router] Error checking ${name} support:`, error);
      }
    }

    if (supportedProviders.length === 0) {
      throw new Error('No provider supports this swap route');
    }

    // 2. Priority logic: Uniswap FIRST for same-chain swaps
    const isSameChain = request.fromChainId === request.toChainId;

    if (isSameChain) {
      const uniswap = supportedProviders.find(p => p.name === 'uniswap');
      if (uniswap) {
        console.log('[Router] ✅ Using Uniswap for same-chain swap');
        try {
          const quote = await uniswap.getQuote(request);
          return { provider: uniswap, quote };
        } catch (error) {
          console.error('[Router] Uniswap failed, trying fallback:', error);
          // Continue to fallback
        }
      }
    }

    // 3. For cross-chain, use Thirdweb (especializado em bridges)
    const thirdweb = supportedProviders.find(p => p.name === 'thirdweb');
    if (thirdweb) {
      console.log('[Router] ✅ Using Thirdweb for cross-chain swap');
      const quote = await thirdweb.getQuote(request);
      return { provider: thirdweb, quote };
    }

    // 4. Fallback: first available provider
    const fallback = supportedProviders[0];
    console.log(`[Router] ⚠️ Using fallback provider: ${fallback.name}`);
    const quote = await fallback.getQuote(request);
    return { provider: fallback, quote };
  }
}