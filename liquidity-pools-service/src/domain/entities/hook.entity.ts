export type HookCategory =
  | 'yield-optimization'  // Bunni, yield farming hooks
  | 'mev-protection'      // Angstrom, MEV protection
  | 'memecoin-launch'     // Flaunch, fair launch mechanisms
  | 'dynamic-fees'        // Dynamic fee adjustment hooks
  | 'limit-orders'        // Limit order functionality
  | 'auto-rebalancing'    // Automatic position rebalancing
  | 'unknown';            // Não está na whitelist

export interface HookCapabilities {
  beforeSwap: boolean;
  afterSwap: boolean;
  beforeAddLiquidity: boolean;
  afterAddLiquidity: boolean;
  beforeRemoveLiquidity: boolean;
  afterRemoveLiquidity: boolean;
}

export class Hook {
  constructor(
    public readonly address: string,
    public readonly chainId: number,
    public readonly name: string,
    public readonly description: string,
    public readonly isSafe: boolean, // Whitelist curada
    public readonly category: HookCategory,
    public readonly capabilities?: HookCapabilities,
    public readonly website?: string,
    public readonly auditReport?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.isValidAddress(this.address)) {
      throw new Error('Invalid hook address');
    }

    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Hook name is required');
    }

    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Hook description is required');
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get risk level based on safety status and category
   */
  public getRiskLevel(): 'low' | 'medium' | 'high' {
    if (!this.isSafe) return 'high';

    switch (this.category) {
      case 'yield-optimization':
      case 'dynamic-fees':
        return 'low';
      case 'mev-protection':
      case 'auto-rebalancing':
        return 'medium';
      case 'memecoin-launch':
      case 'limit-orders':
        return 'medium';
      case 'unknown':
      default:
        return 'high';
    }
  }

  /**
   * Get warning message for users
   */
  public getWarningMessage(): string | null {
    if (this.isSafe) return null;

    return `⚠️ CAUTION: This hook (${this.name}) may modify swap/LP behavior in unexpected ways. ` +
           `It has not been verified by our security team. Proceed with caution and only invest ` +
           `what you can afford to lose.`;
  }

  /**
   * Get user-friendly description with capabilities
   */
  public getDetailedDescription(): string {
    let description = this.description;

    if (this.capabilities) {
      const capabilities = [];
      if (this.capabilities.beforeSwap || this.capabilities.afterSwap) {
        capabilities.push('swap hooks');
      }
      if (this.capabilities.beforeAddLiquidity || this.capabilities.afterAddLiquidity) {
        capabilities.push('add liquidity hooks');
      }
      if (this.capabilities.beforeRemoveLiquidity || this.capabilities.afterRemoveLiquidity) {
        capabilities.push('remove liquidity hooks');
      }

      if (capabilities.length > 0) {
        description += ` Implements: ${capabilities.join(', ')}.`;
      }
    }

    return description;
  }

  /**
   * Check if hook affects specific operation
   */
  public affectsOperation(operation: 'swap' | 'addLiquidity' | 'removeLiquidity'): boolean {
    if (!this.capabilities) return true; // Assume all operations if not specified

    switch (operation) {
      case 'swap':
        return this.capabilities.beforeSwap || this.capabilities.afterSwap;
      case 'addLiquidity':
        return this.capabilities.beforeAddLiquidity || this.capabilities.afterAddLiquidity;
      case 'removeLiquidity':
        return this.capabilities.beforeRemoveLiquidity || this.capabilities.afterRemoveLiquidity;
      default:
        return false;
    }
  }

  /**
   * Get display badge for UI
   */
  public getBadge(): { text: string; color: string } {
    if (this.isSafe) {
      return { text: 'VERIFIED', color: 'green' };
    }

    switch (this.getRiskLevel()) {
      case 'low':
        return { text: 'LOW RISK', color: 'yellow' };
      case 'medium':
        return { text: 'MEDIUM RISK', color: 'orange' };
      case 'high':
        return { text: 'HIGH RISK', color: 'red' };
      default:
        return { text: 'UNKNOWN', color: 'gray' };
    }
  }
}