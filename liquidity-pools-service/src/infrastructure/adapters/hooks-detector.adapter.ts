import { Hook, HookCategory } from '../../domain/entities/hook.entity';

/**
 * HooksDetectorAdapter
 *
 * MVP: Whitelist manual de hooks conhecidos
 *
 * Fase 2 (futura): Discovery automático via subgraph
 */
export class HooksDetectorAdapter {
  // Whitelist curada manualmente - principais hooks conhecidos
  private readonly knownHooks = new Map<string, KnownHook>([
    // Bunni - Yield optimization hook
    ['0x67F93d36792c49a4493652B91ad4bD59f428AD15', {
      name: 'Bunni Rehypothecation',
      description: 'Auto-deposits idle liquidity to Aave for additional yield',
      isSafe: true,
      category: 'yield-optimization',
      website: 'https://bunni.pro',
      capabilities: {
        beforeSwap: false,
        afterSwap: false,
        beforeAddLiquidity: true,
        afterAddLiquidity: true,
        beforeRemoveLiquidity: true,
        afterRemoveLiquidity: true
      }
    }],

    // Flaunch - Memecoin fair launch
    ['0x742d35Cc6584Fb3c1DE5c6E5F5e43b3B3a85d5E2', {
      name: 'Flaunch',
      description: 'Fair launch mechanism with automatic fee buyback and burn',
      isSafe: true,
      category: 'memecoin-launch',
      website: 'https://flaunch.io',
      capabilities: {
        beforeSwap: true,
        afterSwap: true,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false
      }
    }],

    // Angstrom - MEV protection
    ['0x9D8A62F656A8D1615C1294FD71E9CFb3E4855A4f', {
      name: 'Angstrom MEV Protection',
      description: 'Protects swaps from MEV attacks through private pools',
      isSafe: true,
      category: 'mev-protection',
      capabilities: {
        beforeSwap: true,
        afterSwap: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false
      }
    }],

    // Dynamic fee hook example
    ['0x123...', {
      name: 'Dynamic Fee Hook',
      description: 'Adjusts swap fees based on volatility and volume',
      isSafe: true,
      category: 'dynamic-fees',
      capabilities: {
        beforeSwap: true,
        afterSwap: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false
      }
    }],

    // Limit order hook
    ['0x456...', {
      name: 'Limit Order Hook',
      description: 'Enables limit orders within V4 pools',
      isSafe: true,
      category: 'limit-orders',
      capabilities: {
        beforeSwap: true,
        afterSwap: true,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false
      }
    }]
  ]);

  async validateHook(address: string, chainId: number): Promise<HookValidation> {
    const normalized = address.toLowerCase();

    // Check whitelist
    const known = this.knownHooks.get(normalized);
    if (known) {
      return {
        isSafe: known.isSafe,
        name: known.name,
        description: known.description,
        category: known.category,
        warning: null,
        capabilities: known.capabilities
      };
    }

    // Unknown hook = warn user
    return {
      isSafe: false,
      name: 'Unknown Hook',
      description: 'This pool uses custom logic that has not been verified by our security team',
      category: 'unknown',
      warning: '⚠️ CAUTION: This hook may modify swap/LP behavior in unexpected ways. ' +
               'It has not been verified by our security team. Proceed with caution and ' +
               'only invest what you can afford to lose.',
      capabilities: undefined
    };
  }

  listKnownHooks(chainId: number): Hook[] {
    return Array.from(this.knownHooks.entries())
      .map(([address, info]) => new Hook(
        address,
        chainId,
        info.name,
        info.description,
        info.isSafe,
        info.category,
        info.capabilities,
        info.website,
        info.auditReport
      ));
  }

  getHooksByCategory(category: HookCategory, chainId: number): Hook[] {
    return this.listKnownHooks(chainId)
      .filter(hook => hook.category === category);
  }

  async getHookDetails(address: string, chainId: number): Promise<Hook | null> {
    const validation = await this.validateHook(address, chainId);

    if (!validation.isSafe && validation.category === 'unknown') {
      return null; // Don't return details for unknown hooks
    }

    const known = this.knownHooks.get(address.toLowerCase());
    if (!known) return null;

    return new Hook(
      address,
      chainId,
      known.name,
      known.description,
      known.isSafe,
      known.category,
      known.capabilities,
      known.website,
      known.auditReport
    );
  }

  /**
   * Check if a hook is safe for a specific operation
   */
  async isHookSafeForOperation(
    hookAddress: string,
    operation: 'swap' | 'addLiquidity' | 'removeLiquidity',
    chainId: number
  ): Promise<boolean> {
    const validation = await this.validateHook(hookAddress, chainId);

    // Unknown hooks are considered unsafe
    if (!validation.isSafe) return false;

    // If we have capability info, check if hook affects this operation
    if (validation.capabilities) {
      const hook = new Hook(
        hookAddress,
        chainId,
        validation.name,
        validation.description,
        validation.isSafe,
        validation.category,
        validation.capabilities
      );

      // If hook doesn't affect this operation, it's safe
      return !hook.affectsOperation(operation);
    }

    // Default to safe for whitelisted hooks without capability info
    return true;
  }

  /**
   * Get recommendation for using a hook
   */
  async getHookRecommendation(hookAddress: string, chainId: number): Promise<HookRecommendation> {
    const validation = await this.validateHook(hookAddress, chainId);

    if (!validation.isSafe) {
      return {
        recommended: false,
        reason: 'Hook is not verified and may pose risks',
        riskLevel: 'high',
        warning: validation.warning || undefined
      };
    }

    // Safe hook recommendations based on category
    switch (validation.category) {
      case 'yield-optimization':
        return {
          recommended: true,
          reason: 'This hook can increase your yield through additional strategies',
          riskLevel: 'low'
        };

      case 'mev-protection':
        return {
          recommended: true,
          reason: 'This hook protects your transactions from MEV attacks',
          riskLevel: 'low'
        };

      case 'dynamic-fees':
        return {
          recommended: true,
          reason: 'This hook adjusts fees dynamically for better capital efficiency',
          riskLevel: 'low'
        };

      case 'memecoin-launch':
      case 'limit-orders':
        return {
          recommended: true,
          reason: 'This hook adds useful functionality to the pool',
          riskLevel: 'medium'
        };

      default:
        return {
          recommended: false,
          reason: 'Hook functionality is unclear',
          riskLevel: 'medium'
        };
    }
  }

  /**
   * Get available hooks with pagination
   */
  async getAvailableHooks(
    chainId: number,
    filters?: {
      category?: string;
      verified?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    hooks: any[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  }> {
    const { category, verified, limit = 20, offset = 0 } = filters || {};

    // Convert known hooks to response format
    const allHooks = Array.from(this.knownHooks.entries()).map(([address, hook]) => ({
      address,
      name: hook.name,
      description: hook.description,
      category: hook.category,
      verified: hook.isSafe,
      isSafe: hook.isSafe,
      website: hook.website,
      capabilities: hook.capabilities
    }));

    let filteredHooks = allHooks;

    if (category) {
      filteredHooks = filteredHooks.filter(h => h.category === category);
    }

    if (verified !== undefined) {
      filteredHooks = filteredHooks.filter(h => h.verified === verified);
    }

    const paginatedHooks = filteredHooks.slice(offset, offset + limit);

    return {
      hooks: paginatedHooks,
      pagination: {
        limit,
        offset,
        total: filteredHooks.length
      }
    };
  }
}

interface KnownHook {
  name: string;
  description: string;
  isSafe: boolean;
  category: HookCategory;
  website?: string;
  auditReport?: string;
  capabilities?: {
    beforeSwap: boolean;
    afterSwap: boolean;
    beforeAddLiquidity: boolean;
    afterAddLiquidity: boolean;
    beforeRemoveLiquidity: boolean;
    afterRemoveLiquidity: boolean;
  };
}

interface HookValidation {
  isSafe: boolean;
  name: string;
  description: string;
  category: HookCategory;
  warning: string | null;
  capabilities?: {
    beforeSwap: boolean;
    afterSwap: boolean;
    beforeAddLiquidity: boolean;
    afterAddLiquidity: boolean;
    beforeRemoveLiquidity: boolean;
    afterRemoveLiquidity: boolean;
  };
}

interface HookRecommendation {
  recommended: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  warning?: string;
}