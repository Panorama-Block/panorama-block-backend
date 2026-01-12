import { randomUUID } from 'crypto';

export interface TacBalanceProps {
  id?: string;
  userId: string;
  tokenSymbol: string; // e.g., 'stETH_TON', 'qUSDC_TON'
  tokenAddress: string; // TON contract address of wrapped token
  balance: string;
  sourceProtocol: string; // 'lido', 'benqi', 'uniswap'
  sourceChain: string; // 'ethereum', 'avalanche', 'base'
  protocolAddress?: string; // Original protocol contract address
  currentApy?: number;
  estimatedYield?: string; // Estimated yield per year
  rewardsEarned?: string;
  rewardsClaimed?: string;
  lastRewardCalc?: Date;
  underlyingAsset?: string; // The original asset (e.g., 'USDC' for 'qUSDC_TON')
  conversionRate?: string; // Current conversion rate to underlying
  isActive?: boolean;
  canClaim?: boolean;
  canRedeem?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastSyncAt?: Date;
}

export class TacBalance {
  private readonly props: TacBalanceProps;

  constructor(props: TacBalanceProps) {
    this.props = {
      ...props,
      id: props.id || randomUUID(),
      rewardsEarned: props.rewardsEarned || '0',
      rewardsClaimed: props.rewardsClaimed || '0',
      isActive: props.isActive !== false,
      canClaim: props.canClaim || false,
      canRedeem: props.canRedeem !== false,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
      lastSyncAt: props.lastSyncAt || new Date()
    };

    this.validate();
  }

  // Getters
  get id(): string { return this.props.id!; }
  get userId(): string { return this.props.userId; }
  get tokenSymbol(): string { return this.props.tokenSymbol; }
  get tokenAddress(): string { return this.props.tokenAddress; }
  get balance(): string { return this.props.balance; }
  get sourceProtocol(): string { return this.props.sourceProtocol; }
  get sourceChain(): string { return this.props.sourceChain; }
  get protocolAddress(): string | undefined { return this.props.protocolAddress; }
  get currentApy(): number | undefined { return this.props.currentApy; }
  get estimatedYield(): string | undefined { return this.props.estimatedYield; }
  get rewardsEarned(): string { return this.props.rewardsEarned!; }
  get rewardsClaimed(): string { return this.props.rewardsClaimed!; }
  get lastRewardCalc(): Date | undefined { return this.props.lastRewardCalc; }
  get underlyingAsset(): string | undefined { return this.props.underlyingAsset; }
  get conversionRate(): string | undefined { return this.props.conversionRate; }
  get isActive(): boolean { return this.props.isActive!; }
  get canClaim(): boolean { return this.props.canClaim!; }
  get canRedeem(): boolean { return this.props.canRedeem!; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }
  get lastSyncAt(): Date { return this.props.lastSyncAt!; }

  // Business methods
  public updateBalance(newBalance: string): void {
    if (!this.isValidAmount(newBalance)) {
      throw new Error('TacBalance: Invalid balance amount');
    }

    this.props.balance = newBalance;
    this.markAsUpdated();
  }

  public updateApy(newApy: number): void {
    if (newApy < 0 || newApy > 100) {
      throw new Error('TacBalance: APY must be between 0 and 100');
    }

    this.props.currentApy = newApy;
    this.updateEstimatedYield();
    this.markAsUpdated();
  }

  public addRewards(rewardAmount: string): void {
    if (!this.isValidAmount(rewardAmount)) {
      throw new Error('TacBalance: Invalid reward amount');
    }

    const currentRewards = parseFloat(this.props.rewardsEarned!);
    const additionalRewards = parseFloat(rewardAmount);
    const newTotal = currentRewards + additionalRewards;

    this.props.rewardsEarned = newTotal.toString();
    this.props.lastRewardCalc = new Date();
    this.markAsUpdated();
  }

  public claimRewards(claimedAmount: string): void {
    if (!this.isValidAmount(claimedAmount)) {
      throw new Error('TacBalance: Invalid claimed amount');
    }

    const earnedAmount = parseFloat(this.props.rewardsEarned!);
    const claimingAmount = parseFloat(claimedAmount);

    if (claimingAmount > earnedAmount) {
      throw new Error('TacBalance: Cannot claim more than earned');
    }

    const currentClaimed = parseFloat(this.props.rewardsClaimed!);
    this.props.rewardsClaimed = (currentClaimed + claimingAmount).toString();
    this.props.rewardsEarned = (earnedAmount - claimingAmount).toString();

    // Update claim status
    this.props.canClaim = parseFloat(this.props.rewardsEarned!) > 0;

    this.markAsUpdated();
  }

  public updateConversionRate(rate: string): void {
    if (!this.isValidAmount(rate)) {
      throw new Error('TacBalance: Invalid conversion rate');
    }

    this.props.conversionRate = rate;
    this.markAsUpdated();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.canClaim = false;
    this.props.canRedeem = false;
    this.markAsUpdated();
  }

  public activate(): void {
    this.props.isActive = true;
    this.props.canRedeem = true;
    // canClaim depends on rewards earned
    this.props.canClaim = parseFloat(this.props.rewardsEarned!) > 0;
    this.markAsUpdated();
  }

  public getBalanceInUnderlying(): string | undefined {
    if (!this.props.conversionRate || !this.props.underlyingAsset) {
      return undefined;
    }

    const balance = parseFloat(this.props.balance);
    const rate = parseFloat(this.props.conversionRate);

    return (balance * rate).toString();
  }

  public getClaimableRewards(): string {
    return this.props.canClaim ? this.props.rewardsEarned! : '0';
  }

  public getRewardRate(): number | undefined {
    if (!this.props.currentApy) return undefined;

    // Convert APY to daily rate
    return this.props.currentApy / 365;
  }

  public getProjectedYearlyRewards(): string | undefined {
    if (!this.props.currentApy) return undefined;

    const balance = parseFloat(this.props.balance);
    const apy = this.props.currentApy / 100; // Convert percentage to decimal

    return (balance * apy).toString();
  }

  public getValueInUSD(tokenPriceUSD?: number): number | undefined {
    if (!tokenPriceUSD) return undefined;

    const balance = parseFloat(this.props.balance);
    return balance * tokenPriceUSD;
  }

  public getTimeSinceLastSync(): number {
    return Date.now() - this.props.lastSyncAt!.getTime();
  }

  public needsSync(maxAgeMs: number = 300000): boolean { // 5 minutes default
    return this.getTimeSinceLastSync() > maxAgeMs;
  }

  public markAsSynced(): void {
    this.props.lastSyncAt = new Date();
    this.markAsUpdated();
  }

  public toJSON(): TacBalanceProps {
    return { ...this.props };
  }

  public toApiResponse(tokenPriceUSD?: number): {
    tokenSymbol: string;
    tokenAddress: string;
    balance: string;
    valueUSD?: number;
    sourceProtocol: string;
    sourceChain: string;
    underlyingAsset?: string;
    currentApy?: number;
    rewardsEarned: string;
    claimableRewards: string;
    canClaim: boolean;
    canRedeem: boolean;
    lastUpdated: string;
    projectedYearlyRewards?: string;
  } {
    return {
      tokenSymbol: this.tokenSymbol,
      tokenAddress: this.tokenAddress,
      balance: this.balance,
      valueUSD: this.getValueInUSD(tokenPriceUSD),
      sourceProtocol: this.sourceProtocol,
      sourceChain: this.sourceChain,
      underlyingAsset: this.underlyingAsset,
      currentApy: this.currentApy,
      rewardsEarned: this.rewardsEarned,
      claimableRewards: this.getClaimableRewards(),
      canClaim: this.canClaim,
      canRedeem: this.canRedeem,
      lastUpdated: this.lastSyncAt!.toISOString(),
      projectedYearlyRewards: this.getProjectedYearlyRewards()
    };
  }

  private validate(): void {
    if (!this.props.userId) {
      throw new Error('TacBalance: userId is required');
    }

    if (!this.props.tokenSymbol) {
      throw new Error('TacBalance: tokenSymbol is required');
    }

    if (!this.props.tokenAddress) {
      throw new Error('TacBalance: tokenAddress is required');
    }

    if (!this.props.balance) {
      throw new Error('TacBalance: balance is required');
    }

    if (!this.isValidAmount(this.props.balance)) {
      throw new Error('TacBalance: balance must be a valid positive number');
    }

    if (!this.props.sourceProtocol) {
      throw new Error('TacBalance: sourceProtocol is required');
    }

    if (!this.props.sourceChain) {
      throw new Error('TacBalance: sourceChain is required');
    }

    // Validate APY if provided
    if (this.props.currentApy !== undefined) {
      if (this.props.currentApy < 0 || this.props.currentApy > 100) {
        throw new Error('TacBalance: currentApy must be between 0 and 100');
      }
    }

    // Validate reward amounts
    if (!this.isValidAmount(this.props.rewardsEarned!)) {
      throw new Error('TacBalance: rewardsEarned must be a valid amount');
    }

    if (!this.isValidAmount(this.props.rewardsClaimed!)) {
      throw new Error('TacBalance: rewardsClaimed must be a valid amount');
    }
  }

  private isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0 && isFinite(num);
  }

  private updateEstimatedYield(): void {
    if (!this.props.currentApy) {
      this.props.estimatedYield = undefined;
      return;
    }

    const balance = parseFloat(this.props.balance);
    const apy = this.props.currentApy / 100;
    const estimatedYearly = balance * apy;

    this.props.estimatedYield = estimatedYearly.toString();
  }

  private markAsUpdated(): void {
    this.props.updatedAt = new Date();
  }
}