// Application Service - Provider Selection Orchestration
// Bridges the gap between domain routing logic and use cases
import { RouterDomainService } from "../../domain/services/router.domain.service";
import { SwapRequest, SwapQuote } from "../../domain/entities/swap";
import { PreparedSwap } from "../../domain/ports/swap.provider.port";

/**
 * QuoteWithProvider
 *
 * Quote result including which provider was selected
 */
export interface QuoteWithProvider {
  provider: string; // Provider name ('uniswap', 'thirdweb')
  quote: SwapQuote;
}

/**
 * PreparedSwapWithProvider
 *
 * Prepared swap result including which provider was used
 */
export interface PreparedSwapWithProvider {
  provider: string; // Provider name ('uniswap', 'thirdweb')
  prepared: PreparedSwap;
}

/**
 * ProviderSelectorService
 *
 * Application service that orchestrates provider selection for swap operations.
 * Acts as a facade over the RouterDomainService, converting between domain
 * types and application-level types.
 *
 * This service:
 * - Delegates routing logic to RouterDomainService
 * - Converts provider instances to string names for API responses
 * - Handles optional provider preferences from users
 *
 * @example
 * ```typescript
 * const selector = new ProviderSelectorService(router);
 *
 * // Auto-select best provider
 * const { provider, quote } = await selector.getQuoteWithBestProvider(request);
 * console.log('Using:', provider); // 'uniswap' or 'thirdweb'
 *
 * // Use specific provider
 * const prepared = await selector.prepareSwapWithProvider(request, 'uniswap');
 * ```
 */
export class ProviderSelectorService {
  constructor(private readonly router: RouterDomainService) {
    console.log("[ProviderSelectorService] Initialized");
  }

  /**
   * Get quote with automatic provider selection
   *
   * This method:
   * 1. Delegates to RouterDomainService for provider selection
   * 2. Converts provider instance to string name
   * 3. Returns quote with provider info
   *
   * @param request - Swap request
   * @returns Quote with provider name
   *
   * @example
   * ```typescript
   * const result = await selector.getQuoteWithBestProvider(swapRequest);
   * // result = { provider: 'uniswap', quote: SwapQuote }
   * ```
   */
  public async getQuoteWithBestProvider(
    request: SwapRequest
  ): Promise<QuoteWithProvider> {
    console.log(
      `[ProviderSelectorService] Getting quote with auto provider selection`
    );

    // Delegate to router domain service
    const { provider, quote } = await this.router.selectBestProvider(request);

    console.log(
      `[ProviderSelectorService] ✅ Auto-selected provider: ${provider.name}`
    );

    return {
      provider: provider.name,
      quote,
    };
  }

  /**
   * Prepare swap with optional provider preference
   *
   * This method:
   * 1. If preferred provider specified: use it directly
   * 2. Otherwise: auto-select best provider
   * 3. Call prepareSwap on selected provider
   * 4. Return prepared transactions
   *
   * @param request - Swap request
   * @param preferredProvider - Optional provider name ('uniswap', 'thirdweb')
   * @returns Prepared swap with transactions
   *
   * @throws Error if preferred provider doesn't exist
   * @throws Error if preferred provider doesn't support route
   *
   * @example
   * ```typescript
   * // Auto-select
   * const prepared = await selector.prepareSwapWithProvider(request);
   *
   * // Force Uniswap
   * const prepared = await selector.prepareSwapWithProvider(request, 'uniswap');
   * ```
   */
  public async prepareSwapWithProvider(
    request: SwapRequest,
    preferredProvider?: string
  ): Promise<PreparedSwapWithProvider> {
    // Case 1: User specified a preferred provider
    if (preferredProvider) {
      console.log(
        `[ProviderSelectorService] Using preferred provider: ${preferredProvider}`
      );

      // Validate provider exists
      if (!this.router.hasProvider(preferredProvider)) {
        const available = this.router.getAvailableProviders();
        throw new Error(
          `Provider '${preferredProvider}' not available. Available providers: ${available.join(", ")}`
        );
      }

      const provider = this.router.getProviderByName(preferredProvider)!;

      // Check if provider supports this route
      const supports = await provider.supportsRoute({
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
      });

      if (!supports) {
        throw new Error(
          `Provider '${preferredProvider}' does not support this swap route (${request.fromChainId} → ${request.toChainId})`
        );
      }

      // Prepare swap with preferred provider
      const prepared = await provider.prepareSwap(request);

      console.log(
        `[ProviderSelectorService] ✅ Prepared swap with ${preferredProvider}`
      );

      return {
        provider: provider.name,
        prepared,
      };
    }

    // Case 2: Auto-select best provider
    console.log(
      "[ProviderSelectorService] Auto-selecting provider for prepare"
    );

    const { provider } = await this.router.selectBestProvider(request);

    const prepared = await provider.prepareSwap(request);

    console.log(
      `[ProviderSelectorService] ✅ Prepared swap with auto-selected ${provider.name}`
    );

    return {
      provider: provider.name,
      prepared,
    };
  }

  /**
   * Get available provider names
   *
   * Useful for API endpoints that want to list available options
   */
  public getAvailableProviders(): string[] {
    return this.router.getAvailableProviders();
  }

  /**
   * Check if a provider is available
   */
  public isProviderAvailable(name: string): boolean {
    return this.router.hasProvider(name);
  }
}
