export interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

export class Position {
  constructor(
    public readonly id: string, // NFT tokenId (V3/V4) ou user-pool hash (V2)
    public readonly protocol: 'v2' | 'v3' | 'v4',
    public readonly chainId: number,
    public readonly owner: string,
    public readonly poolId: string,
    public readonly token0: Token,
    public readonly token1: Token,
    public readonly liquidity: bigint,
    // V3/V4 specific
    public readonly tickLower?: number,
    public readonly tickUpper?: number,
    public readonly feeTier?: number,
    // V4 specific
    public readonly hookAddress?: string,
    // Fees
    public readonly unclaimedFees?: {
      token0: bigint;
      token1: bigint;
    },
    // Metadata
    public readonly createdAt: Date = new Date(),
    public readonly lastUpdated: Date = new Date()
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.protocol !== 'v2' && !this.tickLower) {
      throw new Error('V3/V4 positions require tickLower/tickUpper');
    }

    if (this.protocol === 'v4' && this.hookAddress && !this.isValidAddress(this.hookAddress)) {
      throw new Error('Invalid hook address for V4 position');
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Check if position is in range (earning fees)
   */
  public isInRange(currentTick: number): boolean {
    if (this.protocol === 'v2') return true; // V2 = full range sempre
    return currentTick >= this.tickLower! && currentTick <= this.tickUpper!;
  }

  /**
   * Calculate range usage (0-1)
   * 0 = bottom of range, 1 = top of range, 0.5 = middle
   */
  public getRangeUsage(currentTick: number): number {
    if (this.protocol === 'v2') return 0.5;
    const range = this.tickUpper! - this.tickLower!;
    const position = currentTick - this.tickLower!;
    return Math.max(0, Math.min(1, position / range));
  }

  /**
   * Check if position uses a V4 hook
   */
  public hasHook(): boolean {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    return Boolean(this.hookAddress && this.hookAddress !== ZERO_ADDRESS);
  }

  /**
   * Check if position can be migrated to target protocol
   */
  public canMigrateTo(targetProtocol: 'v2' | 'v3' | 'v4'): boolean {
    // V2 → V3/V4 ✅
    if (this.protocol === 'v2') return targetProtocol !== 'v2';

    // V3 → V4 ✅
    if (this.protocol === 'v3') return targetProtocol === 'v4';

    // V4 → não pode fazer downgrade (perde hooks)
    if (this.protocol === 'v4') return false;

    return false;
  }

  /**
   * Calculate position value in token units
   */
  public getPositionValue(): { token0Amount: bigint; token1Amount: bigint } {
    // Simplified calculation - in real implementation, this would use
    // complex math based on current price and liquidity
    const token0Amount = this.liquidity / 2n;
    const token1Amount = this.liquidity / 2n;

    return { token0Amount, token1Amount };
  }

  /**
   * Get human readable description
   */
  public getDescription(): string {
    const pairName = `${this.token0.symbol}/${this.token1.symbol}`;
    const protocolStr = this.protocol.toUpperCase();

    if (this.protocol === 'v2') {
      return `${protocolStr} ${pairName} LP`;
    }

    const feePercent = this.feeTier ? (this.feeTier / 10000).toFixed(2) : '0.00';
    return `${protocolStr} ${pairName} ${feePercent}%${this.hasHook() ? ' (Hook)' : ''}`;
  }

  /**
   * Check if position is out of range (V3/V4 only)
   */
  public isOutOfRange(currentTick: number): boolean {
    return this.protocol !== 'v2' && !this.isInRange(currentTick);
  }
}