// Domain Entity - Protocol Fee Configuration

export class ProtocolFeeConfig {
  private readonly _id: string;
  private readonly _provider: string;
  private readonly _taxInPercent: number;
  private readonly _taxInBips: number | null;
  private readonly _taxInEth: bigint | null;
  private readonly _isActive: boolean;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: string,
    provider: string,
    taxInPercent: number,
    isActive: boolean = true,
    taxInBips: number | null = null,
    taxInEth: bigint | null = null,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    this.validateProvider(provider);
    this.validateTaxInPercent(taxInPercent);

    this._id = id;
    this._provider = provider;
    this._taxInPercent = taxInPercent;
    this._taxInBips = taxInBips;
    this._taxInEth = taxInEth;
    this._isActive = isActive;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? new Date();
  }

  private validateProvider(provider: string): void {
    const validProviders = ["thirdweb", "uniswap"];
    if (!validProviders.includes(provider)) {
      throw new Error(
        `Invalid provider: ${provider}. Must be one of: ${validProviders.join(", ")}`
      );
    }
  }

  private validateTaxInPercent(tax: number): void {
    if (tax < 0 || tax > 100) {
      throw new Error(
        `Tax percentage must be between 0 and 100. Received: ${tax}`
      );
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get provider(): string {
    return this._provider;
  }
  get taxInPercent(): number {
    return this._taxInPercent;
  }
  get taxInBips(): number | null {
    return this._taxInBips;
  }
  get taxInEth(): bigint | null {
    return this._taxInEth;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Calculate the protocol fee for a given amount
   *
   * @param amount - The swap amount in wei
   * @returns The protocol fee in wei
   */
  public calculateFee(amount: bigint): bigint {
    if (!this._isActive) return 0n;

    // Calculate percentage: (amount * taxInPercent) / 100
    // Use BigInt multiplication with scaling to avoid precision loss
    // taxInPercent = 0.5 means 0.5%
    // fee = amount * 0.5 / 100 = amount * 0.005 = amount * 5 / 1000
    const taxScaled = BigInt(Math.round(this._taxInPercent * 10000)); // 0.5% -> 5000
    const fee = (amount * taxScaled) / 1000000n; // Divide by 1,000,000 (10000 * 100)

    return fee;
  }
}

// Default fee configurations
export const DEFAULT_FEE_CONFIGS: Record<string, number> = {
  thirdweb: 0.5, // 0.5%
  uniswap: 0.5, // 0.5%
};
