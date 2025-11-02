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

interface QuoteOutput {
  amount?: string;
  token?: string;
  recipient?: string;
}

interface AggregatedOutput {
  amount?: string;
  token?: string;
  recipient?: string;
  bps?: number;
  minAmount?: string;
}

interface UniswapQuoteResponse {
  quote: {
    amount?: string; // Output amount in token units
    priceImpact?: string; // e.g., "0.15" = 0.15%
    exchangeRate?: string; // e.g., "3000.50"
    output?: QuoteOutput;
    aggregatedOutputs?: AggregatedOutput[];
    gasFee?: string;
    gasFeeQuote?: string;
    quoteId?: string; // Unique identifier for the quote
    slippage?: number; // Slippage tolerance (e.g., 5 = 5%)
    expiresAt?: number; // Unix timestamp when quote expires
  };
  route?: RouteHop[];
  gasEstimate?: GasEstimate;
  expiresAt?: number; // Unix timestamp
  slippage?: string;
  gasPriceWei?: string;
  permitData?: Record<string, unknown>;
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
  swap: {
    to: string;
    data: string;
    value: string;
    chainId: number | string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  gasFee?: string;
  requestId?: string;
  quote?: UniswapQuoteResponse;
  route?: RouteHop[];
  expiresAt?: number;
}

interface UniswapApprovalRequest {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
  includeGasInfo?: boolean;
  // Optional: Destination token for Permit2 validation context
  tokenOut?: string;
  tokenOutChainId?: number;
}

interface UniswapApprovalResponse {
  approval: UniswapPreparedTransaction | null;
  cancel: UniswapPreparedTransaction | null;
  gasFee?: string;
  cancelGasFee?: string;
  requestId?: string;
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
  private readonly slippagePercent: number; // e.g., 5.0 = 5%

  // Quote cache to reuse between getQuote() and prepareSwap()
  // Key format: `${chainId}:${fromToken}:${toToken}:${amount}:${sender}`
  private readonly quoteCache = new Map<string, {
    quote: any;
    timestamp: number;
    expiresAt: number;
  }>();
  private readonly quoteCacheTTL = 60000; // 60 seconds

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

    // Configurable slippage tolerance - default to 20.0% for better MetaMask compatibility
    // This can be overridden via UNISWAP_TRADING_API_SLIPPAGE env variable
    // Higher slippage prevents "Transaction canceled" errors due to price movement during simulation
    // CRITICAL: MetaMask simulates with current block state, but quote is from previous block
    const rawSlippage = process.env.UNISWAP_TRADING_API_SLIPPAGE;
    const parsedSlippage = rawSlippage ? parseFloat(rawSlippage) : undefined;
    this.slippagePercent = parsedSlippage && parsedSlippage > 0 ? parsedSlippage : 20.0;

    if (!this.config.apiKey) {
      console.warn('[UniswapTradingApiAdapter] ⚠️ No API key configured. Set UNISWAP_API_KEY env var.');
    }

    console.log(`[${this.name}] 📊 Configured slippage tolerance: ${this.slippagePercent}%`);

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
        slippageTolerance: this.slippagePercent, // Configurable via UNISWAP_TRADING_API_SLIPPAGE
        enableUniversalRouter: true,
        simulateTransaction: true, // Enable simulation to catch errors early
        urgency: 'urgent', // Use urgent for faster execution
        // Use traditional on-chain approval instead of Permit2 signature
        // This generates an approval transaction that can be sent on-chain
        // instead of requiring the user to sign a Permit2 message
        generatePermitAsTransaction: true,
      };

      console.log(`[${this.name}] Using slippage tolerance: ${this.slippagePercent}%`);

      // Call API with retry
      const response = await this.retryRequest<UniswapQuoteResponse>(
        () => this.client.post(endpoint, payload)
      );

      const routeTypes = Array.isArray(response?.route)
        ? response.route.map((h) => h?.type).filter(Boolean)
        : [];

      // CRITICAL DEBUG: Log full quote structure to understand API response
      console.log(`[${this.name}] 🔍 FULL QUOTE RESPONSE:`, JSON.stringify(response, null, 2));

      console.log(`[${this.name}] ✅ Quote received:`, {
        outputAmount: response.quote?.amount,
        output: response.quote?.output,
        aggregatedOutputs: response.quote?.aggregatedOutputs,
        priceImpact: response.quote?.priceImpact,
        route: routeTypes,
        quoteId: response.quote?.quoteId,
      });

      // Cache the quote for reuse in prepareSwap()
      this.cacheQuote(request, response);

      // Map to domain entity
      return this.mapToSwapQuote(response, request);

    } catch (error) {
      throw this.handleError(error, 'getQuote');
    }
  }

  /**
   * Check if token approval is needed
   *
   * CRITICAL: Must include tokenOut and tokenOutChainId for Permit2 context.
   * The Universal Router uses Permit2 which needs to validate the approval
   * against the specific swap route (tokenIn -> tokenOut).
   */
  private async checkApproval(request: SwapRequest): Promise<UniswapApprovalResponse | null> {
    // Native tokens (ETH, MATIC, etc.) don't need approval
    if (this.isNativeToken(request.fromToken)) {
      console.log(`[${this.name}] ⏭️ Skipping approval check for native token`);
      return null;
    }

    try {
      console.log(`[${this.name}] 🔍 Checking token approval with full swap context...`);

      const approvalRequest: any = {
        walletAddress: request.sender,
        token: this.normalizeTokenAddress(request.fromToken),
        amount: request.amount.toString(),
        chainId: request.fromChainId,
        includeGasInfo: true,
        urgency: 'urgent', // Use urgent for faster gas prices
        // CRITICAL: Include destination token for Permit2 validation
        tokenOut: this.normalizeTokenAddress(request.toToken),
        tokenOutChainId: request.toChainId,
      };

      console.log(`[${this.name}] 📤 Approval request:`, {
        token: approvalRequest.token,
        tokenOut: approvalRequest.tokenOut,
        amount: approvalRequest.amount,
        chainId: approvalRequest.chainId,
      });

      const approvalResponse = await this.retryRequest<UniswapApprovalResponse>(
        () => this.client.post('/check_approval', approvalRequest)
      );

      console.log(`[${this.name}] ✅ Approval check result:`, {
        needsApproval: !!approvalResponse.approval,
        needsCancel: !!approvalResponse.cancel,
        hasRequestId: !!approvalResponse.requestId,
      });

      // Log approval transaction details if present
      if (approvalResponse.approval) {
        console.log(`[${this.name}] 📝 Approval transaction required:`, {
          to: approvalResponse.approval.to,
          hasData: !!approvalResponse.approval.data,
          value: approvalResponse.approval.value,
          gasFee: approvalResponse.gasFee,
        });
      }

      if (approvalResponse.cancel) {
        console.log(`[${this.name}] ⚠️ Cancel transaction required (token needs reset):`, {
          to: approvalResponse.cancel.to,
          hasData: !!approvalResponse.cancel.data,
          value: approvalResponse.cancel.value,
          cancelGasFee: approvalResponse.cancelGasFee,
        });
      }

      return approvalResponse;
    } catch (error) {
      console.error(`[${this.name}] ❌ Approval check failed:`, (error as Error).message);
      // Log full error for debugging
      console.error(`[${this.name}] Full error:`, error);
      // Continue without approval check - let the swap attempt and fail with better error message
      return null;
    }
  }

  /**
   * Prepare swap transactions (with approval if needed)
   */
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    const endpoint = '/swap';

    try {
      console.log(`[${this.name}] 🔧 Preparing swap for ${request.toLogString()}`);

      // Step 1: Check if approval is needed
      const approvalCheck = await this.checkApproval(request);

      // Step 2: Try to get cached quote first (to reuse the same quoteId)
      let quoteResponse = this.getCachedQuote(request);

      // If no cached quote, get a fresh one
      if (!quoteResponse) {
        console.log(`[${this.name}] No cached quote, fetching fresh quote...`);

        // Build request payload
        const payload = {
          tokenIn: this.normalizeTokenAddress(request.fromToken),
          tokenOut: this.normalizeTokenAddress(request.toToken),
          amount: request.amount.toString(),
          type: 'EXACT_INPUT',
          tokenInChainId: request.fromChainId,
          tokenOutChainId: request.toChainId,
          swapper: request.sender,
          recipient: request.receiver !== request.sender ? request.receiver : undefined,
          slippageTolerance: this.slippagePercent, // Configurable via UNISWAP_TRADING_API_SLIPPAGE
          enableUniversalRouter: true,
          simulateTransaction: true, // Enable simulation to catch errors early
          urgency: 'urgent', // Use urgent for faster execution
        };

        console.log(`[${this.name}] Preparing swap with ${this.slippagePercent}% slippage`);

        quoteResponse = await this.retryRequest<UniswapQuoteResponse>(
          () => this.client.post('/quote', payload)
        );

        // Cache this new quote
        this.cacheQuote(request, quoteResponse);
      } else {
        console.log(`[${this.name}] ♻️ Reusing cached quote with slippage: ${this.slippagePercent}%`);
      }

      if (!quoteResponse?.quote) {
        throw new SwapError(
          SwapErrorCode.PROVIDER_ERROR,
          'Uniswap Trading API returned an empty quote',
          { rawResponse: quoteResponse },
          502
        );
      }

      // Extract minAmount from quote for validation
      const quoteMinAmount = quoteResponse.quote?.aggregatedOutputs?.[0]?.minAmount;

      console.log(`[${this.name}] ✅ Quote for prepare received`, {
        amount: quoteResponse.quote?.amount,
        output: quoteResponse.quote?.output?.amount,
        minAmount: quoteMinAmount,
        quoteId: (quoteResponse.quote as any)?.quoteId,
        slippage: quoteResponse.quote?.slippage,
      });

      // Step 3: Prepare swap transaction
      // CRITICAL: Send the entire quote object as-is to the /swap endpoint
      // Do NOT delete permitData - the API needs it for validation
      const swapPayload: any = { quote: quoteResponse.quote };

      const response = await this.retryRequest<UniswapCreateResponse>(
        () => this.client.post(endpoint, swapPayload)
      );

      // DEBUG: Log full response structure
      console.log(`[${this.name}] 🔍 Full swap response:`, {
        hasSwap: !!response?.swap,
        hasQuote: !!response?.quote,
        hasRoute: !!response?.route,
        hasGasFee: !!response?.gasFee,
        hasRequestId: !!response?.requestId,
        responseKeys: response ? Object.keys(response) : [],
      });

      const swapTx = response?.swap;

      if (!swapTx) {
        console.error(`[${this.name}] ❌ No swap transaction in response`);
        throw new SwapError(
          SwapErrorCode.NO_ROUTE_FOUND,
          "Uniswap Trading API returned no swap transaction",
          { swapResponse: response },
          502
        );
      }

      console.log(`[${this.name}] ✅ Swap transaction received:`, {
        to: swapTx.to,
        value: swapTx.value,
        hasData: !!swapTx.data,
        dataLength: swapTx.data?.length,
        chainId: swapTx.chainId,
        gasLimit: swapTx.gasLimit,
        maxFeePerGas: swapTx.maxFeePerGas,
        maxPriorityFeePerGas: swapTx.maxPriorityFeePerGas,
      });

      // Log full transaction data for debugging
      console.log(`[${this.name}] 🔍 FULL SWAP TX DATA:`, JSON.stringify({
        to: swapTx.to,
        data: swapTx.data?.substring(0, 200) + '...',
        value: swapTx.value,
        chainId: swapTx.chainId,
        gasLimit: swapTx.gasLimit,
      }, null, 2));

      // CRITICAL FIX: Uniswap Trading API sometimes encodes wrong minAmountOut in calldata
      // We need to patch the last 32 bytes with the correct minAmount from the quote
      if (swapTx.data && quoteMinAmount) {
        const originalData = swapTx.data;
        const minAmountFromCalldata = '0x' + originalData.slice(-64);
        const expectedMinAmount = BigInt(quoteMinAmount);
        const actualMinAmount = BigInt(minAmountFromCalldata);

        if (actualMinAmount !== expectedMinAmount) {
          console.warn(`[${this.name}] ⚠️ MinAmount mismatch detected in calldata!`);
          console.warn(`[${this.name}]    Expected: ${expectedMinAmount.toString()} (from quote)`);
          console.warn(`[${this.name}]    Got:      ${actualMinAmount.toString()} (from API calldata)`);
          console.warn(`[${this.name}]    Difference: ${(actualMinAmount - expectedMinAmount).toString()}`);
          console.warn(`[${this.name}]    Patching calldata with correct minAmount...`);

          // Replace last 32 bytes with correct minAmount
          const minAmountHex = expectedMinAmount.toString(16).padStart(64, '0');
          swapTx.data = originalData.slice(0, -64) + minAmountHex;

          console.log(`[${this.name}] ✅ Calldata patched successfully`);
          console.log(`[${this.name}]    New minAmount: ${minAmountHex} = ${expectedMinAmount.toString()}`);
        } else {
          console.log(`[${this.name}] ✅ MinAmount in calldata matches quote (${expectedMinAmount.toString()})`);
        }
      }

      // Step 4: Build transactions array
      const transactions: Transaction[] = [];

      // Add cancel approval if needed (some tokens require reset)
      if (approvalCheck?.cancel) {
        console.log(`[${this.name}] 📝 Adding cancel approval transaction`);
        transactions.push(this.mapTransaction(approvalCheck.cancel, 'Cancel previous approval'));
      }

      // Add approval if needed
      if (approvalCheck?.approval) {
        console.log(`[${this.name}] 📝 Adding approval transaction`);
        transactions.push(this.mapTransaction(approvalCheck.approval, 'Approve token'));
      } else if (!this.isNativeToken(request.fromToken)) {
        // CRITICAL FIX: If API says no approval needed for ERC-20, but we suspect it's wrong,
        // try to force approval creation by calling check_approval with unlimited amount
        console.warn(`[${this.name}] ⚠️ API says no approval needed, but this is an ERC-20 token.`);
        console.warn(`[${this.name}] ⚠️ Attempting to force approval creation...`);

        try {
          const UNLIMITED_APPROVAL = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1
          const forceApprovalRequest: any = {
            walletAddress: request.sender,
            token: this.normalizeTokenAddress(request.fromToken),
            amount: UNLIMITED_APPROVAL, // Max uint256
            chainId: request.fromChainId,
            includeGasInfo: true,
            urgency: 'urgent',
            tokenOut: this.normalizeTokenAddress(request.toToken),
            tokenOutChainId: request.toChainId,
          };

          const forceApprovalResponse = await this.retryRequest<UniswapApprovalResponse>(
            () => this.client.post('/check_approval', forceApprovalRequest)
          );

          if (forceApprovalResponse?.approval) {
            console.log(`[${this.name}] ✅ Forced approval transaction created!`);
            transactions.push(this.mapTransaction(forceApprovalResponse.approval, 'Approve token (forced)'));
          } else {
            console.log(`[${this.name}] ℹ️ Even with unlimited amount, API says no approval needed.`);
            console.log(`[${this.name}] ℹ️ Wallet may already have sufficient approval.`);
          }
        } catch (forceError) {
          console.error(`[${this.name}] ⚠️ Failed to force approval creation:`, forceError);
          // Continue anyway - the swap might still work if approval truly exists
        }
      }

      // Add swap transaction
      console.log(`[${this.name}] 📝 Adding swap transaction`);
      transactions.push(this.mapTransaction(swapTx, 'Execute swap'));

      if (transactions.length === 0) {
        console.error(`[${this.name}] ❌ No transactions found in response:`,
          JSON.stringify(response, null, 2)
        );
        throw new SwapError(
          SwapErrorCode.NO_ROUTE_FOUND,
          "Uniswap Trading API returned no executable transactions",
          {
            quote: quoteResponse.quote,
            swapResponse: response,
          },
          502
        );
      }

      return {
        provider: this.name,
        transactions,
        estimatedDuration: 30, // Typical swap time in seconds
        expiresAt: response?.expiresAt ? new Date(response.expiresAt * 1000) : undefined,
        metadata: {
          quote: response.quote,
          route: response.route,
          gasFee: response.gasFee,
          // CRITICAL: Skip MetaMask simulation since we patched the calldata
          // MetaMask simulation uses current block state, but our quote is from a previous block
          skipSimulation: true,
          slippageTolerance: `${this.slippageBps / 100}%`,
          minAmountOut: quoteMinAmount,
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
    const quote = response.quote ?? ({} as UniswapQuoteResponse['quote']);

    const outputAmountRaw =
      quote.amount ??
      quote.output?.amount ??
      quote.aggregatedOutputs?.[0]?.amount;

    if (!outputAmountRaw) {
      throw new SwapError(
        SwapErrorCode.PROVIDER_ERROR,
        'Uniswap Trading API returned an empty quote amount',
        { rawResponse: response },
        502
      );
    }

    const outputAmount = BigInt(outputAmountRaw);

    const gasFeeRaw =
      response.gasEstimate?.estimatedCostWei ??
      quote.gasFee ??
      quote.gasFeeQuote;
    const gasFee = gasFeeRaw ? BigInt(gasFeeRaw) : 0n;

    // Bridge fee (0 for same-chain swaps)
    const bridgeFee = 0n;

    // Exchange rate (already calculated by Uniswap)
    const exchangeRate =
      quote.exchangeRate !== undefined
        ? parseFloat(quote.exchangeRate)
        : parseFloat(outputAmountRaw) /
          parseFloat(request.amount.toString());

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
  private mapTransaction(
    tx: {
      to: string;
      data: string;
      value: string | number;
      chainId: number | string;
      gasLimit?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    },
    description?: string
  ): Transaction {
    return {
      chainId: typeof tx.chainId === 'string' ? Number(tx.chainId) : tx.chainId,
      to: tx.to,
      data: tx.data,
      value: typeof tx.value === 'string' ? tx.value : tx.value.toString(),
      gasLimit: tx.gasLimit,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      description,
    };
  }

  /**
   * Check if token is native (ETH, MATIC, etc.)
   */
  private isNativeToken(address: string): boolean {
    const lower = address.toLowerCase();
    return (
      lower === 'native' ||
      lower === '0x0000000000000000000000000000000000000000' ||
      lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  }

  /**
   * Normalize token address for API
   */
  private normalizeTokenAddress(address: string): string {
    // Native token keywords → 0xeeee...eeee (42 e's)
    if (this.isNativeToken(address)) {
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

  /**
   * Generate cache key for quote
   */
  private getCacheKey(request: SwapRequest): string {
    return `${request.fromChainId}:${request.fromToken}:${request.toToken}:${request.amount}:${request.sender}`;
  }

  /**
   * Store quote in cache
   */
  private cacheQuote(request: SwapRequest, quoteResponse: any): void {
    const key = this.getCacheKey(request);
    const now = Date.now();

    // Extract expiresAt from quote if available
    const expiresAt = quoteResponse.quote?.expiresAt
      ? quoteResponse.quote.expiresAt * 1000 // Convert to ms
      : now + this.quoteCacheTTL;

    this.quoteCache.set(key, {
      quote: quoteResponse,
      timestamp: now,
      expiresAt: expiresAt,
    });

    console.log(`[${this.name}] 💾 Cached quote for ${this.quoteCacheTTL / 1000}s`, {
      key: key.substring(0, 50) + '...',
      expiresIn: Math.round((expiresAt - now) / 1000) + 's',
      quoteId: quoteResponse.quote?.quoteId,
    });
  }

  /**
   * Get cached quote if still valid
   */
  private getCachedQuote(request: SwapRequest): any | null {
    const key = this.getCacheKey(request);
    const cached = this.quoteCache.get(key);

    if (!cached) {
      console.log(`[${this.name}] 📭 No cached quote found`);
      return null;
    }

    const now = Date.now();

    // Check if cache is expired
    if (now > cached.expiresAt) {
      console.log(`[${this.name}] ⏰ Cached quote expired`);
      this.quoteCache.delete(key);
      return null;
    }

    const ageSeconds = Math.round((now - cached.timestamp) / 1000);
    console.log(`[${this.name}] ✅ Using cached quote (age: ${ageSeconds}s)`, {
      quoteId: cached.quote?.quote?.quoteId,
    });

    return cached.quote;
  }

  /**
   * Clear expired quotes from cache (cleanup)
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.quoteCache.entries()) {
      if (now > value.expiresAt) {
        this.quoteCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[${this.name}] 🧹 Cleaned up ${cleaned} expired quotes from cache`);
    }
  }
}
