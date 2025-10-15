// Uniswap Provider Adapter
// Implements ISwapProvider using Uniswap Trading API
import { ISwapProvider, RouteParams, PreparedSwap, Transaction } from "../../domain/ports/swap.provider.port";
import { SwapRequest, SwapQuote, TransactionStatus } from "../../domain/entities/swap";
import { UniswapAPIClient } from "./uniswap/uniswap.api.client";
import { UniswapRouting, UNISWAP_SUPPORTED_CHAINS, UNISWAP_NATIVE_TOKEN_ADDRESS, DEFAULT_SLIPPAGE_TOLERANCE } from "./uniswap/constants";
import { QuoteResponse } from "./uniswap/types";
import { getTokenDecimals } from "../../utils/token.utils";
import { isNativeLike } from "../../utils/native.utils";
import { ChainProviderAdapter } from "./chain.provider.adapter";

/**
 * UniswapProviderAdapter
 *
 * Integrates with Uniswap Trading API for same-chain swaps.
 *
 * Features:
 * - V2/V3/V4 protocol routing
 * - UniswapX gasless swaps
 * - Automatic best routing
 * - Permit2 approval support
 *
 * Limitations:
 * - ONLY same-chain swaps (no bridges)
 * - Requires API key
 *
 * @example
 * ```typescript
 * const provider = new UniswapProviderAdapter();
 *
 * const supports = await provider.supportsRoute({
 *   fromChainId: 1,
 *   toChainId: 1, // same chain
 *   fromToken: 'USDC',
 *   toToken: 'ETH'
 * }); // returns true
 *
 * const quote = await provider.getQuote(swapRequest);
 * ```
 */
export class UniswapProviderAdapter implements ISwapProvider {
  public readonly name = "uniswap";

  private readonly client: UniswapAPIClient;
  private readonly chainProvider: ChainProviderAdapter;
  private readonly enabled: boolean;

  constructor() {
    const apiKey = process.env.UNISWAP_API_KEY || "";
    this.enabled = process.env.UNISWAP_ENABLED === "true" && !!apiKey;

    if (!this.enabled) {
      console.warn("[UniswapProvider] ⚠️ Provider disabled (UNISWAP_ENABLED !== true or no API key)");
    }

    this.client = new UniswapAPIClient(apiKey);
    this.chainProvider = new ChainProviderAdapter();

    console.log(`[UniswapProvider] Initialized (enabled: ${this.enabled})`);
  }

  /**
   * Check if Uniswap supports this route
   *
   * Uniswap Trading API only supports SAME-CHAIN swaps.
   * It does NOT do cross-chain bridges.
   */
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // 1. Check if provider is enabled
    if (!this.enabled) {
      console.log("[UniswapProvider] Provider disabled");
      return false;
    }

    // 2. Uniswap only supports same-chain swaps
    if (params.fromChainId !== params.toChainId) {
      console.log("[UniswapProvider] Cross-chain not supported");
      return false;
    }

    // 3. Check if chain is supported
    if (!UNISWAP_SUPPORTED_CHAINS.has(params.fromChainId)) {
      console.log(`[UniswapProvider] Chain ${params.fromChainId} not supported`);
      return false;
    }

    console.log(`[UniswapProvider] ✅ Route supported (chain ${params.fromChainId})`);
    return true;
  }

  /**
   * Get swap quote from Uniswap
   *
   * Calls Uniswap Trading API /quote endpoint
   * Returns domain SwapQuote entity
   */
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    console.log("[UniswapProvider] Getting quote:", request.toLogString());

    try {
      // Normalize token addresses for Uniswap API
      const tokenIn = this.normalizeTokenAddress(request.fromToken);
      const tokenOut = this.normalizeTokenAddress(request.toToken);

      // Call Uniswap API
      const quoteResponse = await this.client.getQuote({
        type: "EXACT_INPUT",
        amount: request.amount.toString(),
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        tokenIn,
        tokenOut,
        swapper: request.sender,
        slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
      });

      console.log("[UniswapProvider] Quote received:", {
        routing: quoteResponse.routing,
        outputAmount: quoteResponse.quote.output.amount,
        priceImpact: quoteResponse.quote.priceImpact,
      });

      // Parse to domain entity
      const estimatedReceiveAmount = BigInt(quoteResponse.quote.output.amount);
      const bridgeFee = BigInt(0); // N/A for same-chain
      const gasFee = await this.parseGasFee(quoteResponse, request.fromChainId);
      const exchangeRate = await this.calculateExchangeRate(
        request.amount,
        estimatedReceiveAmount,
        request.fromToken,
        request.toToken,
        request.fromChainId
      );
      const estimatedDuration = this.getEstimatedDuration(quoteResponse.routing);

      const quote = new SwapQuote(
        estimatedReceiveAmount,
        bridgeFee,
        gasFee,
        exchangeRate,
        estimatedDuration
      );

      console.log("[UniswapProvider] ✅ Quote parsed:", {
        receiveAmount: estimatedReceiveAmount.toString(),
        gasFee: gasFee.toString(),
        exchangeRate,
        duration: estimatedDuration,
      });

      return quote;
    } catch (error) {
      console.error("[UniswapProvider] ❌ Quote failed:", (error as Error).message);
      throw new Error(`Uniswap quote failed: ${(error as Error).message}`);
    }
  }

  /**
   * Prepare swap transactions
   *
   * Flow:
   * 1. Get fresh quote to determine routing (CLASSIC vs UniswapX)
   * 2. Check if approval needed
   * 3. Build transactions based on routing type
   */
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    console.log("[UniswapProvider] Preparing swap:", request.toLogString());

    try {
      // Step 1: Get fresh quote
      const tokenIn = this.normalizeTokenAddress(request.fromToken);
      const tokenOut = this.normalizeTokenAddress(request.toToken);

      const quoteResponse = await this.client.getQuote({
        type: "EXACT_INPUT",
        amount: request.amount.toString(),
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        tokenIn,
        tokenOut,
        swapper: request.sender,
        slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
      });

      const routing = quoteResponse.routing;
      console.log("[UniswapProvider] Quote routing:", routing);

      // Step 2: Check approval (skip for native tokens)
      if (!isNativeLike(request.fromToken)) {
        const approvalCheck = await this.client.checkApproval({
          walletAddress: request.sender,
          token: tokenIn,
          amount: request.amount.toString(),
          chainId: request.fromChainId,
        });

        // Check if approval transaction is required
        if (approvalCheck.approval !== null) {
          console.log("[UniswapProvider] ⚠️ Approval required");

          // Check if Permit2 (gasless signature) is available
          if (approvalCheck.permit2) {
            throw new Error(
              `PERMIT2_SIGNATURE_REQUIRED: ${JSON.stringify(approvalCheck.permit2)}`
            );
          }

          // Traditional approval transaction needed
          throw new Error("APPROVAL_REQUIRED: Token approval needed");
        }
      }

      // Step 3: Build transactions based on routing
      const transactions: Transaction[] = [];
      let expiresAt: Date | undefined;

      if (routing === UniswapRouting.CLASSIC) {
        // V2/V3/V4 swap (gasful)
        console.log("[UniswapProvider] Creating CLASSIC swap transaction");

        const swapResponse = await this.client.createSwap({
          quote: quoteResponse.quote,
        });

        transactions.push({
          chainId: swapResponse.transactionRequest.chainId,
          to: swapResponse.transactionRequest.to,
          data: swapResponse.transactionRequest.data,
          value: swapResponse.transactionRequest.value,
          gasLimit: swapResponse.transactionRequest.gasLimit,
          maxFeePerGas: swapResponse.transactionRequest.maxFeePerGas,
          maxPriorityFeePerGas: swapResponse.transactionRequest.maxPriorityFeePerGas,
        });

        // CLASSIC swaps expire quickly
        expiresAt = new Date(Date.now() + 60000); // 1 minute
      } else {
        // UniswapX order (gasless)
        console.log("[UniswapProvider] Creating UniswapX order");

        const orderResponse = await this.client.createOrder({
          quote: quoteResponse.quote,
        });

        console.log("[UniswapProvider] UniswapX order created:", orderResponse.orderId);

        // For UniswapX, return order data as metadata
        // Frontend will need to submit this off-chain
        transactions.push({
          chainId: request.fromChainId,
          to: "0x0000000000000000000000000000000000000000", // No on-chain TX
          data: orderResponse.encodedOrder,
          value: "0",
        });

        // UniswapX orders have longer expiry
        expiresAt = new Date(orderResponse.orderInfo.deadline * 1000);
      }

      const prepared: PreparedSwap = {
        provider: this.name,
        transactions,
        estimatedDuration: this.getEstimatedDuration(routing),
        expiresAt,
        metadata: {
          routing,
          quote: quoteResponse,
        },
      };

      console.log("[UniswapProvider] ✅ Swap prepared:", {
        routing,
        transactionsCount: transactions.length,
        expiresAt,
      });

      return prepared;
    } catch (error) {
      console.error("[UniswapProvider] ❌ Prepare failed:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Monitor transaction status
   *
   * For CLASSIC swaps: query on-chain transaction
   * For UniswapX orders: query order status API
   */
  async monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus> {
    console.log("[UniswapProvider] Monitoring transaction:", txHash);

    try {
      // Check if it's an on-chain transaction (0x...) or order ID
      if (txHash.startsWith("0x") && txHash.length === 66) {
        // On-chain transaction - use RPC
        console.log("[UniswapProvider] Monitoring on-chain transaction");

        const provider = this.chainProvider.getProvider(chainId);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!receipt) {
          return TransactionStatus.PENDING;
        }

        if (receipt.status === 1) {
          return TransactionStatus.COMPLETED;
        } else {
          return TransactionStatus.FAILED;
        }
      } else {
        // UniswapX order - use API
        console.log("[UniswapProvider] Monitoring UniswapX order");

        const statusResponse = await this.client.getOrderStatus({
          orderId: txHash,
        });

        if (statusResponse.orders.length === 0) {
          return TransactionStatus.PENDING;
        }

        const order = statusResponse.orders[0];

        switch (order.status) {
          case "filled":
            return TransactionStatus.COMPLETED;
          case "error":
          case "cancelled":
          case "insufficient-funds":
            return TransactionStatus.FAILED;
          case "expired":
            return TransactionStatus.FAILED;
          default:
            return TransactionStatus.PENDING;
        }
      }
    } catch (error) {
      console.error("[UniswapProvider] Monitor error:", (error as Error).message);
      return TransactionStatus.PENDING;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Normalize token address for Uniswap API
   *
   * Uniswap expects native tokens as 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
   */
  private normalizeTokenAddress(token: string): string {
    if (isNativeLike(token)) {
      return UNISWAP_NATIVE_TOKEN_ADDRESS;
    }
    return token;
  }

  /**
   * Parse gas fee from quote response
   *
   * Priority: gasFee > gasUseEstimate * gasPrice > fallback
   */
  private async parseGasFee(quoteResponse: QuoteResponse, chainId: number): Promise<bigint> {
    // 1. Use gasFee if provided by API
    if (quoteResponse.quote.gasFee) {
      console.log("[UniswapProvider] Using gasFee from API:", quoteResponse.quote.gasFee);
      return BigInt(quoteResponse.quote.gasFee);
    }

    // 2. Calculate from gasUseEstimate
    if (quoteResponse.quote.gasUseEstimate) {
      console.log("[UniswapProvider] Calculating gas from estimate:", quoteResponse.quote.gasUseEstimate);

      const gasLimit = BigInt(quoteResponse.quote.gasUseEstimate);

      // Get real gas price from chain
      try {
        const provider = this.chainProvider.getProvider(chainId);
        const feeData = await provider.getFeeData();

        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
        if (gasPrice) {
          const gasFee = gasLimit * BigInt(gasPrice.toString());
          console.log("[UniswapProvider] Calculated gas fee:", gasFee.toString());
          return gasFee;
        }
      } catch (error) {
        console.warn("[UniswapProvider] Failed to get gas price from chain:", (error as Error).message);
      }

      // Fallback: conservative gas price
      const fallbackGasPrice = BigInt(30_000_000_000); // 30 gwei
      return gasLimit * fallbackGasPrice;
    }

    // 3. Last resort: conservative estimate
    console.warn("[UniswapProvider] No gas data, using fallback estimate");
    const fallbackGasLimit = BigInt(300000);
    const fallbackGasPrice = BigInt(30_000_000_000);
    return fallbackGasLimit * fallbackGasPrice;
  }

  /**
   * Calculate exchange rate between two tokens
   *
   * Returns price adjusted for decimals
   */
  private async calculateExchangeRate(
    amountIn: bigint,
    amountOut: bigint,
    tokenIn: string,
    tokenOut: string,
    chainId: number
  ): Promise<number> {
    try {
      // Get token decimals
      const decimalsIn = await getTokenDecimals(chainId, tokenIn);
      const decimalsOut = await getTokenDecimals(chainId, tokenOut);

      // Convert to numbers (safe for display purposes)
      const inNumber = Number(amountIn) / Math.pow(10, decimalsIn);
      const outNumber = Number(amountOut) / Math.pow(10, decimalsOut);

      if (inNumber === 0) return 0;

      const rate = outNumber / inNumber;
      console.log("[UniswapProvider] Exchange rate:", rate);

      return rate;
    } catch (error) {
      console.warn("[UniswapProvider] Failed to calculate exchange rate:", (error as Error).message);
      return 1;
    }
  }

  /**
   * Get estimated duration based on routing type
   */
  private getEstimatedDuration(routing: UniswapRouting): number {
    switch (routing) {
      case UniswapRouting.CLASSIC:
        return 30; // 30 seconds for V2/V3/V4
      case UniswapRouting.DUTCH_V2:
      case UniswapRouting.DUTCH_V3:
      case UniswapRouting.PRIORITY:
        return 120; // 2 minutes for UniswapX orders
      case UniswapRouting.BRIDGE:
        return 600; // 10 minutes (shouldn't happen for same-chain)
      default:
        return 60; // 1 minute default
    }
  }

  /**
   * Test API connection (useful for health checks)
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    return this.client.testConnection();
  }
}
