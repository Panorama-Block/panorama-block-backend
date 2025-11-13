/**
 * Swap Configuration
 * Defines slippage tolerance and swap parameters
 */

/**
 * Maximum allowed slippage percentage (e.g., 1.0 = 1%)
 * This protects users from unfavorable price movements during swap execution
 */
export const MAX_SLIPPAGE_PERCENT = parseFloat(process.env.MAX_SLIPPAGE_PERCENT || '1.0');

/**
 * Deadline for swap transactions (in seconds from now)
 * Transactions older than this will be reverted
 */
export const SWAP_DEADLINE_SECONDS = parseInt(process.env.SWAP_DEADLINE_SECONDS || '1200'); // 20 minutes default

/**
 * Uniswap V3 Router address on Ethereum mainnet
 */
export const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

/**
 * WETH address on Ethereum mainnet
 */
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

/**
 * Uniswap V3 fee tiers (in basis points)
 */
export const UNISWAP_FEE_TIERS = {
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000    // 1%
} as const;

/**
 * Calculate minimum amount out with slippage protection
 * @param amountOut Expected output amount
 * @param slippagePercent Slippage tolerance (e.g., 1.0 = 1%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumAmountOut(
  amountOut: bigint,
  slippagePercent: number = MAX_SLIPPAGE_PERCENT
): bigint {
  // Calculate: amountOut * (1 - slippagePercent/100)
  const slippageFactor = BigInt(Math.floor((100 - slippagePercent) * 100));
  const minAmount = (amountOut * slippageFactor) / BigInt(10000);
  return minAmount;
}

/**
 * Validate slippage percentage
 * @param slippage Slippage percentage to validate
 * @throws Error if slippage is invalid
 */
export function validateSlippage(slippage: number): void {
  if (slippage < 0 || slippage > 50) {
    throw new Error(`Invalid slippage: ${slippage}%. Must be between 0 and 50%`);
  }
  if (slippage > MAX_SLIPPAGE_PERCENT) {
    console.warn(`[Swap Config] Warning: Slippage ${slippage}% exceeds recommended maximum ${MAX_SLIPPAGE_PERCENT}%`);
  }
}
