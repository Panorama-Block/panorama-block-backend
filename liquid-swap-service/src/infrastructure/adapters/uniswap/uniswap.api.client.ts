// Uniswap Trading API Client
// HTTP client for comunicating with Uniswap Trading API
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import {
  QuoteParams,
  QuoteResponse,
  CheckApprovalParams,
  CheckApprovalResponse,
  SwapParams,
  SwapResponse,
  OrderParams,
  OrderResponse,
  OrderStatusParams,
  OrderStatusResponse,
  ErrorResponse,
} from './types';
import {
  UNISWAP_API_ENDPOINTS,
  API_REQUEST_TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY,
} from './constants';

/**
 * UniswapAPIClient
 *
 * Low-level HTTP client for Uniswap Trading API.
 * Handles authentication, error handling, retries, and rate limiting.
 *
 * @example
 * ```typescript
 * const client = new UniswapAPIClient('your-api-key');
 * const quote = await client.getQuote({
 *   tokenIn: 'USDC',
 *   tokenOut: 'ETH',
 *   amount: '1000000',
 *   type: 'EXACT_INPUT',
 *   recipient: '0x...',
 *   slippage: '0.5',
 *   chainId: 1,
 * });
 * ```
 */
export class UniswapAPIClient {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly axios: AxiosInstance;

  constructor(apiKey: string, baseURL?: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Uniswap API key is required');
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL || process.env.UNISWAP_API_URL || 'https://trade-api.gateway.uniswap.org/v1';

    // Create axios instance with defaults
    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: API_REQUEST_TIMEOUT,
    });

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        console.log(
          `[UniswapAPI] ✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`
        );
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          console.error(
            `[UniswapAPI] ❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'FAILED'}`
          );
        }
        return Promise.reject(error);
      }
    );

    console.log(`[UniswapAPIClient] Initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Get swap quote
   *
   * POST /quote
   * Returns quote with routing information
   */
  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    console.log('[UniswapAPI] Getting quote:', {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: params.amount,
      tokenInChainId: params.tokenInChainId,
      tokenOutChainId: params.tokenOutChainId,
    });

    return this.requestWithRetry<QuoteResponse>({
      method: 'POST',
      url: UNISWAP_API_ENDPOINTS.QUOTE,
      data: params,
    });
  }

  /**
   * Check if token approval is needed
   *
   * POST /check_approval
   * Returns approval requirements (Permit2 or traditional)
   */
  async checkApproval(params: CheckApprovalParams): Promise<CheckApprovalResponse> {
    console.log('[UniswapAPI] Checking approval:', {
      token: params.token,
      walletAddress: params.walletAddress,
      chainId: params.chainId,
    });

    return this.requestWithRetry<CheckApprovalResponse>({
      method: 'POST',
      url: UNISWAP_API_ENDPOINTS.CHECK_APPROVAL,
      data: params,
    });
  }

  /**
   * Create swap transaction (CLASSIC routing)
   *
   * POST /swap
   * Returns transaction data ready for signature
   */
  async createSwap(params: SwapParams): Promise<SwapResponse> {
    console.log('[UniswapAPI] Creating swap transaction:', {
      tokenIn: params.quote.tokenIn,
      tokenOut: params.quote.tokenOut,
      chainId: params.quote.tokenInChainId,
    });

    return this.requestWithRetry<SwapResponse>({
      method: 'POST',
      url: UNISWAP_API_ENDPOINTS.SWAP,
      data: params,
    });
  }

  /**
   * Create UniswapX order (DUTCH_V2/DUTCH_V3/PRIORITY routing)
   *
   * POST /order
   * Returns order data for gasless swap
   */
  async createOrder(params: OrderParams): Promise<OrderResponse> {
    console.log('[UniswapAPI] Creating UniswapX order:', {
      tokenIn: params.quote.tokenIn,
      tokenOut: params.quote.tokenOut,
      chainId: params.quote.tokenInChainId,
    });

    return this.requestWithRetry<OrderResponse>({
      method: 'POST',
      url: UNISWAP_API_ENDPOINTS.ORDER,
      data: params,
    });
  }

  /**
   * Get order status (UniswapX)
   *
   * GET /orders
   * Returns order status and fill information
   */
  async getOrderStatus(params: OrderStatusParams): Promise<OrderStatusResponse> {
    console.log('[UniswapAPI] Getting order status:', params);

    // Build query string
    const queryParams = new URLSearchParams();
    if (params.orderId) queryParams.append('orderId', params.orderId);
    if (params.swapper) queryParams.append('swapper', params.swapper);
    if (params.status) queryParams.append('status', params.status);

    return this.requestWithRetry<OrderStatusResponse>({
      method: 'GET',
      url: `${UNISWAP_API_ENDPOINTS.ORDERS}?${queryParams.toString()}`,
    });
  }

  /**
   * Make HTTP request with error handling
   *
   * Handles Uniswap-specific errors and converts them to meaningful messages
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.request<T>(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make HTTP request with automatic retry logic
   *
   * Retries on transient errors (5xx, rate limits)
   * Does NOT retry on client errors (4xx, except 429)
   */
  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    attempt = 1
  ): Promise<T> {
    try {
      return await this.request<T>(config);
    } catch (error) {
      const isRetriable = this.isRetriableError(error);
      const canRetry = attempt < MAX_RETRY_ATTEMPTS;

      if (isRetriable && canRetry) {
        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), 10000);

        console.warn(
          `[UniswapAPI] ⚠️ Retry attempt ${attempt}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`
        );

        await this.sleep(delay);
        return this.requestWithRetry<T>(config, attempt + 1);
      }

      // No retry, throw error
      throw error;
    }
  }

  /**
   * Handle and transform API errors
   */
  private handleError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      return error as Error;
    }

    const axiosError = error as AxiosError<ErrorResponse>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    // Build meaningful error message
    let message = 'Uniswap API error';

    if (status === 401) {
      message = 'Uniswap API: Invalid or missing API key';
    } else if (status === 404) {
      message = 'Uniswap API: No route found for this swap';
    } else if (status === 419) {
      message = 'Uniswap API: Rate limit exceeded. Please try again later';
    } else if (status === 400) {
      message = `Uniswap API: Invalid request - ${data?.message || axiosError.message}`;
    } else if (status === 500 || status === 502 || status === 503 || status === 504) {
      message = `Uniswap API: Server error (${status}). Please try again`;
    } else if (data?.message) {
      message = `Uniswap API: ${data.message}`;
    } else if (axiosError.message) {
      message = `Uniswap API: ${axiosError.message}`;
    }

    console.error('[UniswapAPI] Error details:', {
      status,
      message: data?.message,
      errorCode: data?.errorCode,
      detail: data?.detail,
    });

    return new Error(message);
  }

  /**
   * Check if error is retriable
   *
   * Retriable errors:
   * - 429 (rate limit)
   * - 5xx (server errors)
   * - Network errors (timeout, connection refused)
   *
   * Non-retriable errors:
   * - 401 (invalid API key)
   * - 404 (no route)
   * - 400 (bad request)
   */
  private isRetriableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;

    // No response = network error = retriable
    if (!status) {
      return true;
    }

    // Rate limit = retriable
    if (status === 429) {
      return true;
    }

    // Server errors = retriable
    if (status >= 500 && status < 600) {
      return true;
    }

    // Client errors = NOT retriable (except 429)
    if (status >= 400 && status < 500) {
      return false;
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Test API key validity
   *
   * Useful for startup health checks
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple quote to test API key
      await this.getQuote({
        type: 'EXACT_INPUT',
        amount: '1000000', // 1 USDC
        tokenInChainId: 1,
        tokenOutChainId: 1,
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        swapper: '0x0000000000000000000000000000000000000000',
        slippageTolerance: 0.5,
      });

      console.log('[UniswapAPI] ✅ Connection test successful');
      return true;
    } catch (error) {
      console.error('[UniswapAPI] ❌ Connection test failed:', (error as Error).message);
      return false;
    }
  }
}
