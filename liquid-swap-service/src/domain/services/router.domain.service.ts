// Domain Service - Provider Routing Logic
// Responsible for selecting the best swap provider based on route characteristics
import { ISwapProvider, RouteParams } from "../ports/swap.provider.port";
import { SwapRequest, SwapQuote } from "../entities/swap";

/**
 * ProviderSelectionResult
 *
 * Result of provider selection with the chosen provider and obtained quote
 */
export interface ProviderSelectionResult {
  provider: ISwapProvider;
  quote: SwapQuote;
}

/**
 * RouterDomainService
 *
 * Domain service that implements the business logic for selecting the best swap provider.
 *
 * Strategy:
 * 1. Same-chain swaps → Prioritize Uniswap (better liquidity, lower fees)
 * 2. Cross-chain swaps → Prioritize Thirdweb (specialized in bridges)
 * 3. Automatic fallback if preferred provider fails
 *
 * @example
 * ```typescript
 * const router = new RouterDomainService(providersMap);
 * const { provider, quote } = await router.selectBestProvider(swapRequest);
 * console.log('Selected:', provider.name);
 * ```
 */
export class RouterDomainService {
  constructor(private readonly providers: Map<string, ISwapProvider>) {
    console.log(
      `[RouterDomainService] Initialized with ${providers.size} providers:`,
      Array.from(providers.keys())
    );
  }

  /**
   * Select the best provider for a given swap request
   *
   * This method:
   * 1. Checks which providers support the route
   * 2. Applies priority logic (Uniswap for same-chain, Thirdweb for cross-chain)
   * 3. Gets quote from preferred provider
   * 4. Falls back to alternative providers if preferred one fails
   *
   * @param request - Swap request with all parameters
   * @returns Selected provider and quote
   * @throws Error if no provider supports the route or all providers fail
   */
  public async selectBestProvider(
    request: SwapRequest
  ): Promise<ProviderSelectionResult> {
    console.log(
      `[RouterDomainService] Selecting provider for: ${request.toLogString()}`
    );

    // 1. Build route parameters
    const routeParams: RouteParams = {
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
    };

    // 2. Check which providers support this route (parallel checks for performance)
    const supportedProviders = await this.getSupportedProviders(routeParams);

    if (supportedProviders.length === 0) {
      console.error(
        "[RouterDomainService] ❌ No provider supports this route:",
        routeParams
      );
      throw new Error(
        `No swap provider supports route ${request.fromChainId} → ${request.toChainId}`
      );
    }

    console.log(
      "[RouterDomainService] Supported providers:",
      supportedProviders.map((p) => p.name)
    );

    // 3. Determine if same-chain or cross-chain
    const isSameChain = this.isSameChain(request);

    // 4. Apply priority logic and try to get quote
    if (isSameChain) {
      return await this.selectForSameChain(supportedProviders, request);
    } else {
      return await this.selectForCrossChain(supportedProviders, request);
    }
  }

  /**
   * Get all providers that support a given route
   *
   * Checks each provider in parallel for performance
   */
  private async getSupportedProviders(
    params: RouteParams
  ): Promise<ISwapProvider[]> {
    const checks = Array.from(this.providers.values()).map(async (provider) => {
      try {
        const supports = await provider.supportsRoute(params);
        return supports ? provider : null;
      } catch (error) {
        console.error(
          `[RouterDomainService] Error checking ${provider.name} support:`,
          (error as Error).message
        );
        return null;
      }
    });

    const results = await Promise.all(checks);
    return results.filter((p): p is ISwapProvider => p !== null);
  }

  /**
   * Select provider for same-chain swap
   *
   * Priority: Uniswap > Thirdweb > others
   */
  private async selectForSameChain(
    supportedProviders: ISwapProvider[],
    request: SwapRequest
  ): Promise<ProviderSelectionResult> {
    console.log("[RouterDomainService] 🔄 Same-chain swap detected");

    // Try Uniswap first (best for same-chain)
    const uniswap = supportedProviders.find((p) => p.name === "uniswap");
    if (uniswap) {
      console.log("[RouterDomainService] ✅ Attempting Uniswap (preferred)");
      try {
        const quote = await uniswap.getQuote(request);
        console.log(
          "[RouterDomainService] ✅ Uniswap quote successful:",
          quote.estimatedReceiveAmount.toString()
        );
        return { provider: uniswap, quote };
      } catch (error) {
        console.warn(
          "[RouterDomainService] ⚠️ Uniswap failed, trying fallback:",
          (error as Error).message
        );
        // Continue to fallback
      }
    }

    // Fallback to other providers
    return await this.tryFallbackProviders(supportedProviders, request, [
      "uniswap",
    ]);
  }

  /**
   * Select provider for cross-chain swap
   *
   * Priority: Thirdweb > others
   */
  private async selectForCrossChain(
    supportedProviders: ISwapProvider[],
    request: SwapRequest
  ): Promise<ProviderSelectionResult> {
    console.log("[RouterDomainService] 🌉 Cross-chain swap detected");

    // Try Thirdweb first (specialized in bridges)
    const thirdweb = supportedProviders.find((p) => p.name === "thirdweb");
    if (thirdweb) {
      console.log("[RouterDomainService] ✅ Attempting Thirdweb (preferred)");
      try {
        const quote = await thirdweb.getQuote(request);
        console.log(
          "[RouterDomainService] ✅ Thirdweb quote successful:",
          quote.estimatedReceiveAmount.toString()
        );
        return { provider: thirdweb, quote };
      } catch (error) {
        console.warn(
          "[RouterDomainService] ⚠️ Thirdweb failed, trying fallback:",
          (error as Error).message
        );
        // Continue to fallback
      }
    }

    // Fallback to other providers
    return await this.tryFallbackProviders(supportedProviders, request, [
      "thirdweb",
    ]);
  }

  /**
   * Try remaining providers as fallback
   *
   * @param supportedProviders - All providers that support the route
   * @param request - Swap request
   * @param excludeNames - Provider names to exclude (already tried)
   */
  private async tryFallbackProviders(
    supportedProviders: ISwapProvider[],
    request: SwapRequest,
    excludeNames: string[]
  ): Promise<ProviderSelectionResult> {
    const fallbackProviders = supportedProviders.filter(
      (p) => !excludeNames.includes(p.name)
    );

    if (fallbackProviders.length === 0) {
      console.error(
        "[RouterDomainService] ❌ No fallback providers available"
      );
      throw new Error(
        "All preferred providers failed and no fallback available"
      );
    }

    console.log(
      "[RouterDomainService] ⚠️ Trying fallback providers:",
      fallbackProviders.map((p) => p.name)
    );

    // Try each fallback provider in order
    const errors: Error[] = [];

    for (const provider of fallbackProviders) {
      try {
        console.log(
          `[RouterDomainService] Attempting fallback: ${provider.name}`
        );
        const quote = await provider.getQuote(request);
        console.log(
          `[RouterDomainService] ✅ Fallback ${provider.name} successful`
        );
        return { provider, quote };
      } catch (error) {
        console.warn(
          `[RouterDomainService] Fallback ${provider.name} failed:`,
          (error as Error).message
        );
        errors.push(error as Error);
      }
    }

    // All providers failed
    console.error(
      "[RouterDomainService] ❌ All providers failed:",
      errors.map((e) => e.message)
    );
    throw new Error(
      `All swap providers failed. Errors: ${errors.map((e) => e.message).join("; ")}`
    );
  }

  /**
   * Check if swap is same-chain
   */
  private isSameChain(request: SwapRequest): boolean {
    return request.fromChainId === request.toChainId;
  }

  /**
   * Get a specific provider by name
   *
   * Useful for when user explicitly requests a provider
   */
  public getProviderByName(name: string): ISwapProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider exists
   */
  public hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get all available provider names
   */
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
