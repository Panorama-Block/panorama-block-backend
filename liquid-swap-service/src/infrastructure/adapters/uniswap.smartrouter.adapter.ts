/**
 * Uniswap Smart Order Router Adapter — DISABLED
 *
 * The @uniswap/smart-order-router package was removed to reduce Docker image size
 * and avoid OOM failures during CI builds. This stub always returns unsupported
 * so the system falls through to the next provider (Thirdweb).
 *
 * The Trading API adapter (uniswap-trading-api) covers the same use cases when
 * a UNISWAP_TRADING_API_KEY is configured.
 */

import { ISwapProvider, RouteParams, PreparedSwap } from '../../domain/ports/swap.provider.port';
import { SwapQuote, SwapRequest, TransactionStatus } from '../../domain/entities/swap';

export class UniswapSmartRouterAdapter implements ISwapProvider {
  public readonly name = 'uniswap-smart-router';

  constructor() {
    console.log(`[${this.name}] Smart Order Router disabled — use uniswap-trading-api or thirdweb`);
  }

  async supportsRoute(_params: RouteParams): Promise<boolean> {
    return false;
  }

  async getQuote(_request: SwapRequest): Promise<SwapQuote> {
    throw new Error(`[${this.name}] Provider disabled`);
  }

  async prepareSwap(_request: SwapRequest): Promise<PreparedSwap> {
    throw new Error(`[${this.name}] Provider disabled`);
  }

  async monitorTransaction(_txHash: string, _chainId: number): Promise<TransactionStatus> {
    throw new Error(`[${this.name}] Provider disabled`);
  }
}
