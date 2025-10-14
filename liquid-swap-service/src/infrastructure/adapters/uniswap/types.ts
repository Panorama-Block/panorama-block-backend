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
  /** Input token address (or 0xEeee... for native) */
  tokenIn: string;

  /** Output token address (or 0xEeee... for native) */
  tokenOut: string;

  /** Amount in smallest unit (wei for ETH, etc.) */
  amount: string;

  /** Trade type */
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';

  /** Recipient address for the swap */
  recipient: string;

  /** Slippage tolerance as percentage string (e.g., "0.5" for 0.5%) */
  slippage: string;

  /** Chain ID */
  chainId: number;

  /** Optional: Enable UniswapX if available */
  enableUniversalRouter?: boolean;
}

/**
 * Quote Response
 */
export interface QuoteResponse {
  /** Routing type determines which endpoint to call next */
  routing: UniswapRouting;

  /** Quote details */
  quote: {
    /** Output amount in smallest unit */
    amount: string;

    /** Output amount in human-readable decimals */
    amountDecimals: string;

    /** Price impact percentage */
    priceImpact: string;

    /** Applied slippage */
    slippage: string;
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
 */
export interface CheckApprovalResponse {
  approval: {
    /** Whether approval transaction is required */
    isRequired: boolean;

    /** Permit2 signature data (gasless approval) */
    permitData?: {
      /** EIP-712 domain */
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };

      /** EIP-712 types */
      types: Record<string, Array<{ name: string; type: string }>>;

      /** EIP-712 values */
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

    /** Traditional approval transaction (fallback) */
    approvalTransaction?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
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
 */
export interface SwapParams {
  /** Input token */
  tokenIn: string;

  /** Output token */
  tokenOut: string;

  /** Amount (wei) */
  amount: string;

  /** Trade type */
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';

  /** Recipient */
  recipient: string;

  /** Slippage tolerance */
  slippage: string;

  /** Chain ID */
  chainId: number;

  /** Permit2 signature data (if approval was via signature) */
  permitData?: {
    /** Signature hex string */
    signature: string;

    /** Permit single data */
    permitSingle: {
      details: {
        token: string;
        amount: string;
        expiration: string;
        nonce: string;
      };
      spender: string;
      sigDeadline: string;
    };
  };
}

/**
 * Swap Response (CLASSIC routing)
 */
export interface SwapResponse {
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
 */
export interface OrderParams {
  /** Input token */
  tokenIn: string;

  /** Output token */
  tokenOut: string;

  /** Amount (wei) */
  amount: string;

  /** Trade type */
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';

  /** Swapper address */
  swapper: string;

  /** Slippage tolerance */
  slippage: string;

  /** Chain ID */
  chainId: number;
}

/**
 * Order Response (UniswapX)
 */
export interface OrderResponse {
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
