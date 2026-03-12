// Aerodrome Provider Adapter
// Calls PanoramaBlock Execution Service to route swaps through Aerodrome on Base
import { ISwapProvider, RouteParams, PreparedSwap, Transaction } from "../../domain/ports/swap.provider.port";
import { SwapRequest, SwapQuote, TransactionStatus } from "../../domain/entities/swap";
import { SwapError, SwapErrorCode } from "../../domain/entities/errors";
import axios, { AxiosInstance } from "axios";

const BASE_CHAIN_ID = 8453;

/**
 * AerodromeProviderAdapter
 *
 * Implements ISwapProvider by calling the PanoramaBlock Execution Service,
 * which routes swaps through Aerodrome Finance on Base.
 *
 * Only supports same-chain swaps on Base (chainId 8453).
 * Aerodrome is the dominant DEX on Base with deep liquidity for AERO pairs,
 * stable pools, and tokens not available on Uniswap.
 */
export class AerodromeProviderAdapter implements ISwapProvider {
  public readonly name = "aerodrome";

  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = process.env.EXECUTION_SERVICE_URL || "http://localhost:3010";
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
    console.log(`[AerodromeProvider] Initialized with execution service at ${baseURL}`);
  }

  /**
   * Check if Aerodrome supports this route.
   * Only supports same-chain Base swaps where an Aerodrome pool exists.
   */
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // Quick reject: only Base same-chain
    if (params.fromChainId !== BASE_CHAIN_ID || params.toChainId !== BASE_CHAIN_ID) {
      return false;
    }

    try {
      const response = await this.client.post("/swap/supports", {
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromToken: params.fromToken,
        toToken: params.toToken,
      });

      const supported = response.data?.supported === true;
      if (supported) {
        console.log(`[AerodromeProvider] Route supported: ${params.fromToken} → ${params.toToken}`);
      }
      return supported;
    } catch (error) {
      console.warn(
        `[AerodromeProvider] supportsRoute check failed:`,
        (error as Error).message
      );
      return false;
    }
  }

  /**
   * Get swap quote from Aerodrome via Execution Service.
   * Automatically picks the best pool type (volatile vs stable).
   */
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    console.log(`[AerodromeProvider] Getting quote: ${request.toLogString()}`);

    try {
      const response = await this.client.post("/swap/quote", {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: request.amount.toString(),
        sender: request.sender,
      });

      const data = response.data;

      return new SwapQuote(
        BigInt(data.estimatedReceiveAmount),
        BigInt(data.bridgeFee || "0"),
        BigInt(data.gasFee || "0"),
        data.exchangeRate || 0,
        data.estimatedDuration || 15
      );
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : (error as Error).message;

      throw new SwapError(
        SwapErrorCode.PROVIDER_ERROR,
        `Aerodrome quote failed: ${msg}`,
        { provider: this.name, originalError: msg }
      );
    }
  }

  /**
   * Prepare swap transactions (approval + swap) for user signature.
   * Returns transactions targeting PanoramaExecutor on Base.
   */
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    console.log(`[AerodromeProvider] Preparing swap: ${request.toLogString()}`);

    try {
      const response = await this.client.post("/swap/prepare", {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: request.amount.toString(),
        sender: request.sender,
        receiver: request.receiver,
      });

      const data = response.data;

      const transactions: Transaction[] = (data.transactions || []).map(
        (tx: any) => ({
          chainId: tx.chainId || BASE_CHAIN_ID,
          to: tx.to,
          data: tx.data || "0x",
          value: typeof tx.value === "bigint" ? tx.value.toString() : tx.value || "0",
          action: tx.description?.includes("Approve") ? "approval" : "swap",
          description: tx.description,
        })
      );

      return {
        provider: this.name,
        transactions,
        estimatedDuration: data.estimatedDuration || 15,
        metadata: {
          protocol: "aerodrome",
          executor: data.metadata?.executor,
          stable: data.metadata?.stable,
        },
      };
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : (error as Error).message;

      throw new SwapError(
        SwapErrorCode.PROVIDER_ERROR,
        `Aerodrome prepare failed: ${msg}`,
        { provider: this.name, originalError: msg }
      );
    }
  }

  /**
   * Monitor transaction status on Base.
   * Since Aerodrome swaps are simple on-chain txs, we check via RPC.
   */
  async monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus> {
    if (chainId !== BASE_CHAIN_ID) {
      return TransactionStatus.FAILED;
    }

    try {
      const { ethers } = await import("ethers");
      const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return TransactionStatus.PENDING;
      }

      return receipt.status === 1
        ? TransactionStatus.COMPLETED
        : TransactionStatus.FAILED;
    } catch {
      return TransactionStatus.PENDING;
    }
  }
}
