import { Token } from './position.entity';

export class Pool {
  constructor(
    public readonly id: string,
    public readonly protocol: 'v2' | 'v3' | 'v4',
    public readonly chainId: number,
    public readonly token0: Token,
    public readonly token1: Token,
    public readonly feeTier: number,
    public readonly tickSpacing: number, // V3/V4 only
    public readonly liquidity: bigint,
    public readonly sqrtPriceX96: bigint, // V3/V4
    public readonly currentTick: number, // V3/V4
    public readonly hookAddress?: string, // V4 only
    public readonly tvl?: number, // USD
    public readonly volume24h?: number,
    public readonly fees24h?: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.protocol !== 'v2' && this.sqrtPriceX96 <= 0n) {
      throw new Error('V3/V4 pools require valid sqrtPriceX96');
    }

    if (this.protocol === 'v4' && this.hookAddress && !this.isValidAddress(this.hookAddress)) {
      throw new Error('Invalid hook address for V4 pool');
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  public hasHook(): boolean {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    return Boolean(this.hookAddress && this.hookAddress !== ZERO_ADDRESS);
  }

  public getPrice(): number {
    if (this.protocol === 'v2') {
      // V2 doesn't have sqrtPriceX96, would need reserves calculation
      return 1.0; // Placeholder
    }

    // Calculate token0/token1 price from sqrtPriceX96
    const sqrtPrice = Number(this.sqrtPriceX96) / (2 ** 96);
    return sqrtPrice ** 2;
  }

  public getAPR(): number {
    if (!this.fees24h || !this.tvl || this.tvl === 0) return 0;
    return (this.fees24h * 365 / this.tvl) * 100; // Annualized
  }

  public getPairName(): string {
    return `${this.token0.symbol}/${this.token1.symbol}`;
  }

  public getFeePercent(): string {
    return (this.feeTier / 10000).toFixed(2);
  }

  public getDisplayName(): string {
    const protocolStr = this.protocol.toUpperCase();
    const pairName = this.getPairName();
    const feeStr = this.getFeePercent();

    if (this.protocol === 'v2') {
      return `${protocolStr} ${pairName}`;
    }

    return `${protocolStr} ${pairName} ${feeStr}%${this.hasHook() ? ' (Hook)' : ''}`;
  }

  /**
   * Check if this pool supports position creation
   */
  public supportsPositions(): boolean {
    // All protocols support position creation, but V4 with unknown hooks might have restrictions
    if (this.protocol === 'v4' && this.hasHook()) {
      // In production, you'd check if the hook is whitelisted/safe
      return true; // For MVP, allow all
    }
    return true;
  }

  /**
   * Get tick spacing for V3/V4 pools
   */
  public getTickSpacing(): number {
    if (this.protocol === 'v2') return 1; // V2 doesn't use ticks

    // Standard tick spacings based on fee tiers
    const standardSpacings: { [fee: number]: number } = {
      500: 10,   // 0.05%
      3000: 60,  // 0.3%
      10000: 200 // 1%
    };

    return standardSpacings[this.feeTier] || this.tickSpacing || 60;
  }

  /**
   * Calculate price range for full range position
   */
  public getFullRangeTicks(): { tickLower: number; tickUpper: number } | null {
    if (this.protocol === 'v2') return null;

    // Uniswap V3/V4 min/max ticks
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;

    const tickSpacing = this.getTickSpacing();

    return {
      tickLower: Math.ceil(MIN_TICK / tickSpacing) * tickSpacing,
      tickUpper: Math.floor(MAX_TICK / tickSpacing) * tickSpacing
    };
  }

  /**
   * Check if pool has sufficient liquidity for meaningful positions
   */
  public hasSufficientLiquidity(): boolean {
    // Minimum TVL threshold for liquidity provision
    const MIN_TVL_USD = 10000; // $10k minimum
    return this.tvl ? this.tvl >= MIN_TVL_USD : this.liquidity > 1000000n;
  }
}