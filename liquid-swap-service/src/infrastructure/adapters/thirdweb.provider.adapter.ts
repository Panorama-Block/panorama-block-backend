// Thirdweb Provider Adapter
// Wraps ThirdwebSwapAdapter to implement ISwapProvider interface
import { ISwapProvider, RouteParams, PreparedSwap, Transaction } from "../../domain/ports/swap.provider.port";
import { SwapRequest, SwapQuote, TransactionStatus } from "../../domain/entities/swap";
import { ThirdwebSwapAdapter } from "./thirdweb.swap.adapter";

/**
 * ThirdwebProviderAdapter
 *
 * Wraps the existing ThirdwebSwapAdapter to conform to the ISwapProvider interface.
 * This enables Thirdweb to work with the multi-provider routing system.
 *
 * Priority: Cross-chain swaps (Uniswap doesn't support cross-chain)
 */
export class ThirdwebProviderAdapter implements ISwapProvider {
  public readonly name = "thirdweb";

  private readonly thirdwebAdapter: ThirdwebSwapAdapter;

  constructor() {
    this.thirdwebAdapter = new ThirdwebSwapAdapter();
    console.log(`[ThirdwebProvider] Initialized`);
  }

  /**
   * Check if Thirdweb supports this route
   *
   * Thirdweb supports ALL routes (same-chain and cross-chain)
   * It's our fallback provider
   */
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // Thirdweb supports everything
    return true;
  }

  /**
   * Get swap quote from Thirdweb Bridge
   */
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    console.log("[ThirdwebProvider] Getting quote:", request.toLogString());
    return this.thirdwebAdapter.getQuote(request);
  }

  /**
   * Prepare swap transactions
   */
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    console.log("[ThirdwebProvider] Preparing swap:", request.toLogString());

    const prepared = await this.thirdwebAdapter.prepareSwap(request);

    // Convert ThirdwebSwapAdapter response to PreparedSwap format
    const transactions: Transaction[] = [];

    // Origin chain transactions
    if (prepared.originTxs && prepared.originTxs.length > 0) {
      for (const tx of prepared.originTxs) {
        transactions.push({
          chainId: tx.chainId,
          to: tx.to,
          data: tx.data || "0x",
          value: tx.value,
          gasLimit: tx.gasLimit,
        });
      }
    }

    return {
      provider: this.name,
      transactions,
      estimatedDuration: 60, // 1 minute default (Thirdweb handles this internally)
      metadata: {
        bridgeQuoteId: prepared.bridgeQuoteId,
        originTxs: prepared.originTxs,
      },
    };
  }

  /**
   * Monitor transaction status
   */
  async monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus> {
    console.log("[ThirdwebProvider] Monitoring transaction:", txHash);
    const statusString = await this.thirdwebAdapter.monitorTransaction(txHash, chainId);

    // Map string status to TransactionStatus enum
    switch (statusString.toLowerCase()) {
      case 'completed':
      case 'success':
        return TransactionStatus.COMPLETED;
      case 'failed':
      case 'error':
        return TransactionStatus.FAILED;
      case 'pending':
      default:
        return TransactionStatus.PENDING;
    }
  }
}
