// Uniswap Trading API Constants
// https://api-docs.uniswap.org/introduction

/**
 * Supported Chains by Uniswap Trading API
 *
 * Source: https://api-docs.uniswap.org/supported-chains
 *
 * Mainnet chains supported as of 2025:
 * - Ethereum (1)
 * - Optimism (10)
 * - Polygon (137)
 * - Base (8453)
 * - Arbitrum (42161)
 * - Avalanche (43114)
 * - BSC (56)
 * - ZKSync (324)
 * - Blast (81457)
 * - Zora (7777777)
 * - Unichain (130)
 * - World Chain (480)
 * - Ink (57073)
 * - Soneium (1868)
 * - Celo (42220)
 */
export const UNISWAP_SUPPORTED_CHAINS = new Set([
  1,       // Ethereum
  10,      // Optimism
  137,     // Polygon
  8453,    // Base
  42161,   // Arbitrum
  43114,   // Avalanche
  56,      // BSC
  324,     // ZKSync
  81457,   // Blast
  7777777, // Zora
  130,     // Unichain
  480,     // World Chain
  57073,   // Ink
  1868,    // Soneium (CORRECTED from 1946)
  42220,   // Celo (ADDED)
]);

/**
 * Testnet chains (for development)
 */
export const UNISWAP_TESTNET_CHAINS = new Set([
  11155111, // Sepolia
  84532,    // Base Sepolia
  421614,   // Arbitrum Sepolia
]);

/**
 * Uniswap Trading API Endpoints
 *
 * Base URL: https://api.gateway.uniswap.org/v2
 */
export const UNISWAP_API_ENDPOINTS = {
  /** Check if token approval is needed (Permit2) */
  CHECK_APPROVAL: '/check_approval',

  /** Get swap quote with routing information */
  QUOTE: '/quote',

  /** Create gasful protocol swap transaction (V2/V3/V4) */
  SWAP: '/swap',

  /** Submit gasless UniswapX order */
  ORDER: '/order',

  /** Check UniswapX order status */
  ORDERS: '/orders',

  /** Create batch swap transactions (EIP-5792) */
  SWAP_5792: '/swap_5792',
} as const;

/**
 * Routing types returned by Uniswap API
 */
export enum UniswapRouting {
  /** V2/V3/V4 protocol swap (gasful) */
  CLASSIC = 'CLASSIC',

  /** UniswapX Dutch auction V2 (gasless) */
  DUTCH_V2 = 'DUTCH_V2',

  /** UniswapX Dutch auction V3 (gasless) */
  DUTCH_V3 = 'DUTCH_V3',

  /** Cross-chain bridge via Uniswap  */
  BRIDGE = 'BRIDGE',

  /** Priority order (gasless) */
  PRIORITY = 'PRIORITY',

  /** Wrap native token (ETH → WETH) */
  WRAP = 'WRAP',

  /** Unwrap native token (WETH → ETH) */
  UNWRAP = 'UNWRAP',

  /** Limit order (UniswapX) */
  LIMIT_ORDER = 'LIMIT_ORDER',

  /** Dutch limit order (UniswapX hybrid) */
  DUTCH_LIMIT = 'DUTCH_LIMIT',
}

/**
 * Uniswap Native Token Address
 *
 * Uniswap API expects native tokens (ETH, MATIC, BNB, etc.) as this address
 */
export const UNISWAP_NATIVE_TOKEN_ADDRESS =
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/**
 * Default slippage tolerance (percentage)
 */
export const DEFAULT_SLIPPAGE_TOLERANCE = '0.5'; // 0.5%

/**
 * Request timeout (milliseconds)
 */
export const API_REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Max retry attempts for failed requests
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Exponential backoff base delay (milliseconds)
 */
export const RETRY_BASE_DELAY = 1000; // 1 second
