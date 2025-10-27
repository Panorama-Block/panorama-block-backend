/**
 * Domain Validation - Zod Schemas
 *
 * Comprehensive validation schemas for all swap operations.
 * Used in controllers to validate incoming requests before processing.
 */

import { z } from 'zod';

// ===== CHAIN & TOKEN VALIDATION =====

/**
 * Supported chain IDs
 */
export const ChainIdSchema = z.union([
  z.literal(1),       // Ethereum
  z.literal(10),      // Optimism
  z.literal(56),      // BSC
  z.literal(137),     // Polygon
  z.literal(8453),    // Base
  z.literal(42161),   // Arbitrum
  z.literal(42220),   // Celo
  z.literal(43114),   // Avalanche
  z.literal(11155111), // Sepolia (testnet)
]);

export type ChainId = z.infer<typeof ChainIdSchema>;

/**
 * Ethereum address validation
 * Accepts:
 * - 0x followed by 40 hex characters
 * - "native" keyword for native tokens
 * - 0xeeee...eeee for native (42 e's)
 */
export const AddressSchema = z.string().refine(
  (val) => {
    const lower = val.toLowerCase();
    // Native token keywords
    if (lower === 'native' || lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return true;
    }
    // Standard Ethereum address
    return /^0x[a-fA-F0-9]{40}$/.test(val);
  },
  { message: 'Invalid Ethereum address or native token identifier' }
);

/**
 * Wei amount validation (string representation of bigint)
 */
export const WeiAmountSchema = z.string().regex(/^\d+$/, 'Amount must be a positive integer string');

/**
 * Slippage tolerance (0.1% to 50%)
 */
export const SlippageSchema = z.string()
  .regex(/^\d+(\.\d+)?$/, 'Slippage must be a decimal number')
  .refine(
    (val) => {
      const num = parseFloat(val);
      return num >= 0.1 && num <= 50;
    },
    { message: 'Slippage must be between 0.1% and 50%' }
  )
  .default('0.5');

/**
 * Unix timestamp (seconds)
 */
export const UnixTimestampSchema = z.number().int().positive();

/**
 * Swap type (EXACT_INPUT or EXACT_OUTPUT)
 */
export const SwapTypeSchema = z.enum(['EXACT_INPUT', 'EXACT_OUTPUT']).default('EXACT_INPUT');

/**
 * Protocol selection
 */
export const ProtocolSchema = z.enum(['v2', 'v3', 'v4', 'uniswapx']);

// ===== REQUEST SCHEMAS =====

/**
 * Base schema for swap requests (without refinement)
 */
const BaseSwapRequestSchema = z.object({
  // Required fields
  fromChainId: ChainIdSchema,
  toChainId: ChainIdSchema,
  fromToken: AddressSchema,
  toToken: AddressSchema,
  amount: WeiAmountSchema,

  // Optional fields
  type: SwapTypeSchema,
  slippage: SlippageSchema,
  deadline: UnixTimestampSchema.optional(),
  protocols: z.array(ProtocolSchema).optional(),
  enableUniversalRouter: z.boolean().optional().default(true),
  simulateTransaction: z.boolean().optional().default(false),

  // Smart account support
  smartAccountAddress: AddressSchema.optional().nullable(),
});

/**
 * Schema for GET /swap/quote
 *
 * @example
 * ```json
 * {
 *   "fromChainId": 1,
 *   "toChainId": 1,
 *   "fromToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
 *   "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *   "amount": "1000000000000000000",
 *   "type": "EXACT_INPUT",
 *   "slippage": "0.5"
 * }
 * ```
 */
export const GetQuoteRequestSchema = BaseSwapRequestSchema.refine(
  (data) => data.fromChainId === data.toChainId,
  {
    message: 'Uniswap Trading API only supports same-chain swaps. Use Thirdweb for cross-chain.',
    path: ['toChainId'],
  }
);

export type GetQuoteRequest = z.infer<typeof GetQuoteRequestSchema>;

/**
 * Schema for POST /swap/prepare
 *
 * Extends GetQuoteRequest with sender (required) and Permit2 fields
 */
export const PrepareSwapRequestSchema = BaseSwapRequestSchema.extend({
  sender: AddressSchema, // Required for preparing transactions
  recipient: AddressSchema.optional(), // If different from sender

  // Permit2 support (optional, for gasless approvals)
  permitSignature: z.string().regex(/^0x[a-fA-F0-9]+$/).optional(),
  permitNonce: z.string().optional(),
  permitExpiration: UnixTimestampSchema.optional(),
}).refine(
  (data) => data.fromChainId === data.toChainId,
  {
    message: 'Uniswap Trading API only supports same-chain swaps. Use Thirdweb for cross-chain.',
    path: ['toChainId'],
  }
);

export type PrepareSwapRequest = z.infer<typeof PrepareSwapRequestSchema>;

/**
 * Schema for GET /swap/approval/check
 *
 * Check if token approval is needed for a swap
 */
export const CheckApprovalRequestSchema = z.object({
  token: AddressSchema,
  amount: WeiAmountSchema,
  chainId: ChainIdSchema,
  walletAddress: AddressSchema,
});

export type CheckApprovalRequest = z.infer<typeof CheckApprovalRequestSchema>;

/**
 * Schema for GET /swap/status/:hash
 *
 * Get transaction status
 */
export const GetStatusRequestSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  chainId: ChainIdSchema,
});

export type GetStatusRequest = z.infer<typeof GetStatusRequestSchema>;

// ===== RESPONSE TYPE INFERENCE =====

/**
 * Helper to infer validated types
 *
 * @example
 * ```typescript
 * const validated = GetQuoteRequestSchema.parse(req.body);
 * // validated is now type-safe GetQuoteRequest
 * ```
 */
export type Validated<T extends z.ZodTypeAny> = z.infer<T>;

// ===== VALIDATION HELPERS =====

/**
 * Validate and parse request data
 *
 * @throws ZodError with detailed validation errors
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safe validation (returns result object instead of throwing)
 */
export function safeValidateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Format Zod errors for API responses
 */
export function formatZodError(error: z.ZodError): {
  code: string;
  message: string;
  details: Array<{ field: string; message: string }>;
} {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    details: error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  };
}
