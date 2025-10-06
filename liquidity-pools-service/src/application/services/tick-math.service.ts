/**
 * TickMathService
 *
 * Conversão entre price (human-readable) e ticks (on-chain)
 *
 * Baseado em: https://docs.uniswap.org/sdk/v3/guides/advanced/tick-math
 */
export class TickMathService {
  // Constants from Uniswap V3/V4
  private readonly MIN_TICK = -887272;
  private readonly MAX_TICK = 887272;
  private readonly Q96 = 2n ** 96n;

  /**
   * Convert price to nearest valid tick
   * @param price - Token0/Token1 price ratio
   */
  priceToTick(price: number): number {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }

    // Formula: tick = log(price) / log(1.0001)
    const tick = Math.log(price) / Math.log(1.0001);

    // Round to nearest valid tick
    const roundedTick = Math.round(tick);

    // Clamp to valid range
    return Math.max(this.MIN_TICK, Math.min(this.MAX_TICK, roundedTick));
  }

  /**
   * Convert tick to price
   * @param tick - On-chain tick value
   */
  tickToPrice(tick: number): number {
    if (tick < this.MIN_TICK || tick > this.MAX_TICK) {
      throw new Error(`Tick ${tick} is out of valid range`);
    }

    // Formula: price = 1.0001^tick
    return Math.pow(1.0001, tick);
  }

  /**
   * Get nearest tick aligned to tickSpacing
   * @param tick - Raw tick
   * @param tickSpacing - Pool's tick spacing (ex: 60 for 0.3% fee tier)
   */
  getNearestUsableTick(tick: number, tickSpacing: number): number {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    // Round to nearest multiple of tickSpacing
    const rounded = Math.round(tick / tickSpacing) * tickSpacing;

    // Ensure within valid range
    return Math.max(this.MIN_TICK, Math.min(this.MAX_TICK, rounded));
  }

  /**
   * Calculate tick range for a given price range and tick spacing
   */
  getPriceRangeTicks(
    lowerPrice: number,
    upperPrice: number,
    tickSpacing: number
  ): { tickLower: number; tickUpper: number } {
    if (lowerPrice >= upperPrice) {
      throw new Error('Lower price must be less than upper price');
    }

    const tickLower = this.getNearestUsableTick(
      this.priceToTick(lowerPrice),
      tickSpacing
    );

    const tickUpper = this.getNearestUsableTick(
      this.priceToTick(upperPrice),
      tickSpacing
    );

    return { tickLower, tickUpper };
  }

  /**
   * Calculate optimal tick range based on current price and desired width
   * @param currentPrice - Current pool price
   * @param widthPercent - Range width as percentage (e.g., 0.1 = 10%)
   * @param tickSpacing - Pool's tick spacing
   */
  getOptimalRange(
    currentPrice: number,
    widthPercent: number,
    tickSpacing: number
  ): { tickLower: number; tickUpper: number; lowerPrice: number; upperPrice: number } {
    if (widthPercent <= 0 || widthPercent >= 1) {
      throw new Error('Width percent must be between 0 and 1');
    }

    const halfWidth = widthPercent / 2;
    const lowerPrice = currentPrice * (1 - halfWidth);
    const upperPrice = currentPrice * (1 + halfWidth);

    const { tickLower, tickUpper } = this.getPriceRangeTicks(
      lowerPrice,
      upperPrice,
      tickSpacing
    );

    return {
      tickLower,
      tickUpper,
      lowerPrice: this.tickToPrice(tickLower),
      upperPrice: this.tickToPrice(tickUpper)
    };
  }

  /**
   * Convert sqrtPriceX96 to human readable price
   */
  sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    const sqrtPrice = Number(sqrtPriceX96) / Number(this.Q96);
    return sqrtPrice ** 2;
  }

  /**
   * Convert price to sqrtPriceX96 format
   */
  priceToSqrtPriceX96(price: number): bigint {
    const sqrtPrice = Math.sqrt(price);
    return BigInt(Math.floor(sqrtPrice * Number(this.Q96)));
  }

  /**
   * Check if current price is within tick range
   */
  isPriceInRange(currentPrice: number, tickLower: number, tickUpper: number): boolean {
    const lowerPrice = this.tickToPrice(tickLower);
    const upperPrice = this.tickToPrice(tickUpper);

    return currentPrice >= lowerPrice && currentPrice <= upperPrice;
  }

  /**
   * Calculate how much of the range is being used
   * Returns 0-1, where 0.5 is center of range
   */
  getRangeUsage(currentPrice: number, tickLower: number, tickUpper: number): number {
    const lowerPrice = this.tickToPrice(tickLower);
    const upperPrice = this.tickToPrice(tickUpper);

    if (currentPrice < lowerPrice) return 0;
    if (currentPrice > upperPrice) return 1;

    // Use log scale for better representation
    const logCurrent = Math.log(currentPrice);
    const logLower = Math.log(lowerPrice);
    const logUpper = Math.log(upperPrice);

    return (logCurrent - logLower) / (logUpper - logLower);
  }

  /**
   * Get common fee tier tick spacings
   */
  getTickSpacingForFeeTier(feeTier: number): number {
    const feeToSpacing: { [key: number]: number } = {
      100: 1,     // 0.01%
      500: 10,    // 0.05%
      3000: 60,   // 0.3%
      10000: 200  // 1%
    };

    return feeToSpacing[feeTier] || 60; // Default to 60
  }

  /**
   * Calculate price impact of a position
   */
  calculatePriceImpact(
    currentPrice: number,
    tickLower: number,
    tickUpper: number,
    liquidityDelta: bigint
  ): number {
    // Simplified calculation - in production you'd use more sophisticated math
    const rangeWidth = this.tickToPrice(tickUpper) - this.tickToPrice(tickLower);
    const relativeSize = Number(liquidityDelta) / 1e18; // Normalize

    // Estimate impact as percentage
    return (relativeSize / rangeWidth) * 0.001; // Very rough estimate
  }

  /**
   * Suggest optimal ranges based on volatility
   */
  suggestRanges(
    currentPrice: number,
    tickSpacing: number,
    strategy: 'conservative' | 'moderate' | 'aggressive'
  ): Array<{ name: string; tickLower: number; tickUpper: number; width: string }> {
    const strategies = {
      conservative: [0.1, 0.2, 0.3], // 10%, 20%, 30% ranges
      moderate: [0.05, 0.1, 0.15],    // 5%, 10%, 15% ranges
      aggressive: [0.02, 0.05, 0.08]  // 2%, 5%, 8% ranges
    };

    const widths = strategies[strategy];

    return widths.map((width, index) => {
      const { tickLower, tickUpper } = this.getOptimalRange(
        currentPrice,
        width,
        tickSpacing
      );

      return {
        name: `${strategy} ${index + 1}`,
        tickLower,
        tickUpper,
        width: `${(width * 100).toFixed(1)}%`
      };
    });
  }
}