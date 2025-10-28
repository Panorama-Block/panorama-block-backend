/**
 * Uniswap Trading API Adapter
 *
 * Official Uniswap REST API integration for optimal same-chain swaps.
 *
 * Features:
 * - Auto-routing between V2/V3/V4/UniswapX
 * - Permit2 support (gasless approvals)
 * - Precise gas estimation
 * - Retry logic with exponential backoff
 * - Structured error handling
 *
 * API Documentation: https://docs.uniswap.org/contracts/trading-api/overview
 *
 * @see https://trade-api.gateway.uniswap.org/v1/api.json
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ISwapProvider, RouteParams, PreparedSwap, Transaction } from '../../domain/ports/swap.provider.port';
import { SwapRequest, SwapQuote, TransactionStatus } from '../../domain/entities/swap';
import {
  SwapError,
  SwapErrorCode,
  createNoRouteError,
  createRateLimitError,
  createTimeoutError,
  createProviderError,
} from '../../domain/entities/errors';

// ===== TYPE DEFINITIONS (from Uniswap API) =====

interface UniswapTokenInfo {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
}

interface RouteHop {
  type: 'v2-pool' | 'v3-pool' | 'v4-pool';
  address: string;
  tokenIn: UniswapTokenInfo;
  tokenOut: UniswapTokenInfo;
  fee?: string; // V3/V4 only (e.g., "500" = 0.05%)
  sqrtPriceX96?: string;
  liquidity?: string;
}

interface GasEstimate {
  gasLimit: string;
  maxFeePerGas: string; // Wei
  maxPriorityFeePerGas: string; // Wei
  estimatedCostWei: string;
}

interface UniswapQuoteResponse {
  quote: {
    amount: string; // Output amount in token units
    priceImpact: string; // e.g., "0.15" = 0.15%
    exchangeRate: string; // e.g., "3000.50"
  };
  route: RouteHop[];
  gasEstimate: GasEstimate;
  expiresAt: number; // Unix timestamp
  slippage: string;
  gasPriceWei: string;
}

interface UniswapPreparedTransaction {
  chainId: number;
  to: string; // Universal Router address
  from: string;
  data: string; // Calldata
  value: string; // Wei to send (0 for ERC20, amount for native ETH)
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

interface UniswapCreateResponse {
  transactions: UniswapPreparedTransaction[];
  approval: UniswapPreparedTransaction | null;
  quote: UniswapQuoteResponse;
  route: RouteHop[];
  expiresAt: number;
}

interface UniswapApprovalResponse {
  needsApproval: boolean;
  currentAllowance: string;
  requiredAllowance: string;
  approvalTransaction: UniswapPreparedTransaction | null;
  spender: string; // Universal Router address
}

// ===== CONFIGURATION =====

interface UniswapTradingApiConfig {
  apiUrl: string;
  apiKey: string;
  timeout: number; // ms
  maxRetries: number;
  retryDelay: number; // ms (base delay for exponential backoff)
}

// ===== ADAPTER IMPLEMENTATION =====

export class UniswapTradingApiAdapter implements ISwapProvider {
  public readonly name = 'uniswap-trading-api';
  private readonly client: AxiosInstance;
  private readonly config: UniswapTradingApiConfig;

  // Supported chains (from Uniswap docs)
  private readonly supportedChains: number[] = [
    1,       // Ethereum
    10,      // Optimism
    56,      // BSC
    137,     // Polygon
    8453,    // Base
    42161,   // Arbitrum
    42220,   // Celo
    43114,   // Avalanche
  ];

  constructor(config?: Partial<UniswapTradingApiConfig>) {
    // Load configuration
    this.config = {
      apiUrl: process.env.UNISWAP_API_URL || 'https://trade-api.gateway.uniswap.org',
      apiKey: process.env.UNISWAP_API_KEY || '',
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second base delay
      ...config,
    };

    if (!this.config.apiKey) {
      console.warn('[UniswapTradingApiAdapter] ⚠️ No API key configured. Set UNISWAP_API_KEY env var.');
    }

    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'User-Agent': 'PanoramaBlock-LiquidSwap/1.0',
      },
    });

    // Request interceptor (logging)
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[${this.name}] → ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error(`[${this.name}] Request error:`, error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor (logging)
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[${this.name}] ← ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          console.error(`[${this.name}] ← ${error.response.status} ${error.config?.url}`, error.response.data);
        } else {
          console.error(`[${this.name}] Network error:`, error.message);
        }
        return Promise.reject(error);
      }
    );

    console.log(`[${this.name}] ✅ Initialized for chains: ${this.supportedChains.join(', ')}`);
  }

  // ===== INTERFACE IMPLEMENTATION =====

  /**
   * Check if this provider supports a given route
   *
   * Uniswap Trading API only supports same-chain swaps
   */
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // Only same-chain
    if (params.fromChainId !== params.toChainId) {
      return false;
    }

    // Check if chain is supported
    return this.supportedChains.includes(params.fromChainId);
  }

  /**
   * Get swap quote from Uniswap Trading API
   */
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    const endpoint = '/quote';

    try {
      console.log(`[${this.name}] 📊 Getting quote for ${request.toLogString()}`);

      // Validate same-chain
      if (request.fromChainId !== request.toChainId) {
        throw new SwapError(
          SwapErrorCode.INVALID_CHAIN,
          'Uniswap Trading API only supports same-chain swaps. Use Thirdweb for cross-chain.',
          { fromChainId: request.fromChainId, toChainId: request.toChainId }
        );
      }

      // Build request payload
      const payload = {
        tokenIn: this.normalizeTokenAddress(request.fromToken),
        tokenOut: this.normalizeTokenAddress(request.toToken),
        amount: request.amount.toString(),
        type: 'EXACT_INPUT',
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        swapper: request.sender, // Required field
        slippage: '0.5', // 0.5% default
        enableUniversalRouter: true,
        simulateTransaction: false,
      };

      // Call API with retry
      const response = await this.retryRequest<UniswapQuoteResponse>(
        () => this.client.post(endpoint, payload)
      );

      const routeTypes = Array.isArray(response?.route)
        ? response.route.map((h) => h?.type).filter(Boolean)
        : [];

      console.log(`[${this.name}] ✅ Quote received:`, {
        outputAmount: response.quote?.amount,
        priceImpact: response.quote?.priceImpact,
        route: routeTypes,
      });

      // Map to domain entity
      return this.mapToSwapQuote(response, request);

    } catch (error) {
      throw this.handleError(error, 'getQuote');
    }
  }

  /**
   * Prepare swap transactions (with approval if needed)
   */
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    const endpoint = '/swap';

    try {
      console.log(`[${this.name}] 🔧 Preparing swap for ${request.toLogString()}`);

      // Build request payload
      const payload = {
        tokenIn: this.normalizeTokenAddress(request.fromToken),
        tokenOut: this.normalizeTokenAddress(request.toToken),
        amount: request.amount.toString(),
        type: 'EXACT_INPUT',
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        sender: request.sender,
        recipient: request.receiver !== request.sender ? request.receiver : undefined,
        slippage: '0.5',
        enableUniversalRouter: true,
      };

      // Call API with retry
      const response = await this.retryRequest<UniswapCreateResponse>(
        () => this.client.post(endpoint, payload)
      );

      console.log(`[${this.name}] ✅ Swap prepared:`, {
        needsApproval: !!response.approval,
        transactionsCount: response.transactions.length,
      });

      // Map to PreparedSwap
      const transactions: Transaction[] = [];

      // Add approval transaction if needed
      if (response.approval) {
        transactions.push(this.mapTransaction(response.approval, 'Approve token'));
      }

      // Add swap transactions
      for (const tx of response.transactions) {
        transactions.push(this.mapTransaction(tx, 'Execute swap'));
      }

      return {
        provider: this.name,
        transactions,
        estimatedDuration: 30, // Typical swap time in seconds
        expiresAt: new Date(response.expiresAt * 1000),
        metadata: {
          quote: response.quote,
          route: response.route,
          needsApproval: !!response.approval,
        },
      };

    } catch (error) {
      throw this.handleError(error, 'prepareSwap');
    }
  }

  /**
   * Monitor transaction status
   *
   * Note: Uniswap Trading API doesn't have a status endpoint.
   * We rely on RPC provider to check transaction receipt.
   */
  async monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus> {
    // TODO: Implement RPC-based status check
    // For now, return PENDING
    console.log(`[${this.name}] 🔍 Monitoring transaction ${txHash} on chain ${chainId}`);
    return TransactionStatus.PENDING;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<any>,
    attempt: number = 1
  ): Promise<T> {
    try {
      const response = await requestFn();
      return response.data;

    } catch (error) {
      // Don't retry on client errors (4xx), except 429 (rate limit)
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;

        if (status >= 400 && status < 500 && status !== 429) {
          throw error; // Client error, don't retry
        }
      }

      // Retry on 5xx or 429 (rate limit)
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff

        console.warn(`[${this.name}] ⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);

        await this.sleep(delay);
        return this.retryRequest(requestFn, attempt + 1);
      }

      throw error; // Max retries exceeded
    }
  }

  /**
   * Error handling and mapping to SwapError
   */
  private handleError(error: unknown, operation: string): SwapError {
    console.error(`[${this.name}] ❌ Error in ${operation}:`, error);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;

        // Map Uniswap API error codes
        switch (data?.errorCode) {
          case 'VALIDATION_ERROR':
            return new SwapError(
              SwapErrorCode.INVALID_TOKEN_ADDRESS,
              data.detail || 'Invalid request parameters',
              { originalError: data },
              400
            );

          case 'NO_ROUTE_FOUND':
            return new SwapError(
              SwapErrorCode.NO_ROUTE_FOUND,
              'No route found for this swap',
              { originalError: data },
              404
            );

          case 'RATE_LIMIT_EXCEEDED':
            return createRateLimitError();

          default:
            return new SwapError(
              SwapErrorCode.PROVIDER_ERROR,
              data.detail || `Uniswap API error: ${status}`,
              { originalError: data, status },
              status
            );
        }
      }

      if (axiosError.request) {
        // Network error
        return new SwapError(
          SwapErrorCode.TIMEOUT,
          'Network error communicating with Uniswap API',
          { originalError: axiosError.message },
          503
        );
      }
    }

    // Unknown error
    return createProviderError(this.name, error as Error);
  }

  /**
   * Map Uniswap quote to domain SwapQuote entity
   */
  private mapToSwapQuote(response: UniswapQuoteResponse, request: SwapRequest): SwapQuote {
    // Parse output amount (comes in token units, need to convert to wei)
    const outputAmount = BigInt(response.quote.amount);

    // Parse gas fee
    const gasFee = BigInt(response.gasEstimate.estimatedCostWei);

    // Bridge fee (0 for same-chain swaps)
    const bridgeFee = 0n;

    // Exchange rate (already calculated by Uniswap)
    const exchangeRate = parseFloat(response.quote.exchangeRate);

    // Estimated duration (typical same-chain swap)
    const estimatedDuration = 30; // seconds

    return new SwapQuote(
      outputAmount,
      bridgeFee,
      gasFee,
      exchangeRate,
      estimatedDuration
    );
  }

  /**
   * Map Uniswap transaction to our Transaction type
   */
  private mapTransaction(tx: UniswapPreparedTransaction, description?: string): Transaction {
    return {
      chainId: tx.chainId,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      description,
    };
  }

  /**
   * Normalize token address for API
   */
  private normalizeTokenAddress(address: string): string {
    const lower = address.toLowerCase();

    // Native token keywords → 0xeeee...eeee (42 e's)
    if (lower === 'native' || lower === '0x0000000000000000000000000000000000000000') {
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    return address;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
