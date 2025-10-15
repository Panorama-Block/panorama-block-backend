// Uniswap Trading API TypeScript Types
// Based on official API documentation: https://api-docs.uniswap.org

import { UniswapRouting } from './constants';

// ============================================================================
// QUOTE ENDPOINT
// ============================================================================

/**
 * Quote Request Parameters
 *
 * POST /quote
 * https://api-docs.uniswap.org/api-reference/swapping/quote
 */
export interface QuoteParams {
  /** Trade type (REQUIRED) */
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';

  /** Amount in smallest unit (wei for ETH, etc.) (REQUIRED) */
  amount: string;

  /** Input token chain ID (REQUIRED) */
  tokenInChainId: number;

  /** Output token chain ID (REQUIRED) */
  tokenOutChainId: number;

  /** Input token address (REQUIRED) */
  tokenIn: string;

  /** Output token address (REQUIRED) */
  tokenOut: string;

  /** Swapper wallet address (REQUIRED) */
  swapper: string;

  /** Slippage tolerance as decimal string (e.g., "0.5" for 0.5%) (OPTIONAL) */
  slippageTolerance?: string;

  /** Enable UniswapX if available (OPTIONAL) */
  enableUniversalRouter?: boolean;

  /** Routing preferences (OPTIONAL) */
  routingPreference?: 'classic' | 'uniswapx' | 'best_price';

  /** Protocol preferences (OPTIONAL) */
  protocols?: Array<'v2' | 'v3' | 'v4' | 'mixed'>;

  /** Simulation options (OPTIONAL) */
  simulate?: boolean;
}

/**
 * Quote Response
 *
 * IMPORTANT: The entire quote object must be passed to /swap or /order endpoints
 */
export interface QuoteResponse {
  /** Request ID for tracking */
  requestId: string;

  /** Routing type determines which endpoint to call next */
  routing: UniswapRouting;

  /** Complete quote object - MUST be passed to /swap or /order */
  quote: {
    /** Request ID */
    requestId: string;

    /** Input token chain ID */
    tokenInChainId: number;

    /** Output token chain ID */
    tokenOutChainId: number;

    /** Input token address */
    tokenIn: string;

    /** Output token address */
    tokenOut: string;

    /** Input amount (wei) */
    amountIn: string;

    /** Output amount (wei) */
    amountOut: string;

    /** Output amount in human-readable decimals */
    amountOutDecimals: string;

    /** Swapper address */
    swapper: string;

    /** Slippage tolerance */
    slippageTolerance: string;

    /** Price impact percentage */
    priceImpact?: string;

    /** Trade type */
    tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  };

  /** Gas fee estimate (wei as string) - for CLASSIC routing */
  gasFee?: string;

  /** Gas usage estimate (units) */
  gasUseEstimate?: string;

  /** Route path - for CLASSIC routing */
  route?: Array<{
    pool: string;
    tokenIn: string;
    tokenOut: string;
    protocol: 'V2' | 'V3' | 'V4';
  }>;

  /** Order info - for UniswapX routing */
  orderInfo?: {
    /** Order ID */
    orderId: string;

    /** Filler address */
    filler: string;

    /** Reactor contract address */
    reactor: string;
  };
}

// ============================================================================
// CHECK APPROVAL ENDPOINT
// ============================================================================

/**
 * Check Approval Request Parameters
 *
 * POST /check_approval
 * https://api-docs.uniswap.org/api-reference/swapping/approval
 */
export interface CheckApprovalParams {
  /** Wallet address */
  walletAddress: string;

  /** Token to approve */
  token: string;

  /** Amount to approve (wei) */
  amount: string;

  /** Chain ID */
  chainId: number;
}

/**
 * Check Approval Response
 *
 * The API returns either:
 * 1. null if no approval needed
 * 2. Permit2 signature data for gasless approval
 * 3. Traditional approval transaction object
 */
export interface CheckApprovalResponse {
  /** Request ID for tracking */
  requestId: string;

  /** Approval transaction (null if no approval needed) */
  approval: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  } | null;

  /** Permit2 data for gasless approval (if available) */
  permit2?: {
    /** EIP-712 domain */
    domain: {
      name: string;
      chainId: number;
      verifyingContract: string;
    };

    /** EIP-712 types */
    types: Record<string, Array<{ name: string; type: string }>>;

    /** EIP-712 values to sign */
    values: {
      permitted: {
        token: string;
        amount: string;
      };
      spender: string;
      nonce: string;
      deadline: string;
    };
  };
}

// ============================================================================
// SWAP ENDPOINT (CLASSIC routing)
// ============================================================================

/**
 * Swap Request Parameters (for CLASSIC routing)
 *
 * POST /swap
 * https://api-docs.uniswap.org/api-reference/swapping/create_swap
 *
 * IMPORTANT: Must include the entire quote object from /quote response
 */
export interface SwapParams {
  /** Complete quote object from /quote endpoint (REQUIRED) */
  quote: {
    requestId: string;
    tokenInChainId: number;
    tokenOutChainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    amountOutDecimals: string;
    swapper: string;
    slippageTolerance: string;
    priceImpact?: string;
    tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  };

  /** Permit2 signature data (if approval was via signature) (OPTIONAL) */
  permit2?: {
    /** EIP-712 signature hex string */
    signature: string;

    /** Permit2 data */
    permitData: {
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };
      types: Record<string, Array<{ name: string; type: string }>>;
      values: {
        permitted: {
          token: string;
          amount: string;
        };
        spender: string;
        nonce: string;
        deadline: string;
      };
    };
  };

  /** Simulation flag (OPTIONAL) */
  simulate?: boolean;
}

/**
 * Swap Response (CLASSIC routing)
 */
export interface SwapResponse {
  /** Request ID for tracking */
  requestId: string;

  /** Transaction to sign and send */
  transactionRequest: {
    /** Contract address to call */
    to: string;

    /** Calldata */
    data: string;

    /** ETH value to send (wei) */
    value: string;

    /** Chain ID */
    chainId: number;

    /** Gas limit estimate */
    gasLimit?: string;

    /** Max fee per gas (EIP-1559) */
    maxFeePerGas?: string;

    /** Max priority fee (EIP-1559) */
    maxPriorityFeePerGas?: string;
  };
}

// ============================================================================
// ORDER ENDPOINT (UniswapX routing)
// ============================================================================

/**
 * Order Request Parameters (for UniswapX routing)
 *
 * POST /order
 *
 * IMPORTANT: Must include the entire quote object from /quote response
 */
export interface OrderParams {
  /** Complete quote object from /quote endpoint (REQUIRED) */
  quote: {
    requestId: string;
    tokenInChainId: number;
    tokenOutChainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    amountOutDecimals: string;
    swapper: string;
    slippageTolerance: string;
    priceImpact?: string;
    tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  };

  /** Permit2 signature data (if approval was via signature) (OPTIONAL) */
  permit2?: {
    /** EIP-712 signature hex string */
    signature: string;

    /** Permit2 data */
    permitData: {
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };
      types: Record<string, Array<{ name: string; type: string }>>;
      values: {
        permitted: {
          token: string;
          amount: string;
        };
        spender: string;
        nonce: string;
        deadline: string;
      };
    };
  };
}

/**
 * Order Response (UniswapX)
 */
export interface OrderResponse {
  /** Request ID for tracking */
  requestId: string;

  /** Unique order ID */
  orderId: string;

  /** Order hash */
  orderHash: string;

  /** Signature to submit */
  signature: string;

  /** Encoded order data */
  encodedOrder: string;

  /** Order details */
  orderInfo: {
    /** Reactor contract */
    reactor: string;

    /** Swapper address */
    swapper: string;

    /** Nonce */
    nonce: string;

    /** Deadline timestamp */
    deadline: number;

    /** Start amount (decay begins from here) */
    startAmount: string;

    /** End amount (decay ends here) */
    endAmount: string;
  };
}

// ============================================================================
// ORDER STATUS ENDPOINT
// ============================================================================

/**
 * Order Status Request Parameters
 *
 * GET /orders?orderId=...
 */
export interface OrderStatusParams {
  /** Order ID to check */
  orderId?: string;

  /** Swapper address to filter by */
  swapper?: string;

  /** Status to filter by */
  status?: OrderStatus;
}

/**
 * Order Status
 */
export type OrderStatus =
  | 'open'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'error'
  | 'insufficient-funds';

/**
 * Order Status Response
 */
export interface OrderStatusResponse {
  orders: Array<{
    /** Order ID */
    orderId: string;

    /** Current status */
    status: OrderStatus;

    /** Fill timestamp (if filled) */
    filledAt?: number;

    /** Fill transaction hash (if filled) */
    txHash?: string;

    /** Error message (if error) */
    errorMessage?: string;
  }>;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

/**
 * API Error Response
 */
export interface ErrorResponse {
  /** HTTP status code */
  statusCode: number;

  /** Error code */
  errorCode: string;

  /** Human-readable error message */
  message: string;

  /** Additional details */
  detail?: string;
}
