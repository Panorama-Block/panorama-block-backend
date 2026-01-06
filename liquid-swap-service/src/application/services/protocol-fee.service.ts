// Application Service - Protocol Fee Service
import { IProtocolFeeRepository } from "../../domain/ports/protocol-fee.repository";
import {
  ProtocolFeeConfig,
  DEFAULT_FEE_CONFIGS,
} from "../../domain/entities/protocol-fee";

/**
 * ProtocolFeeService
 *
 * Application service that calculates protocol fees for swaps.
 * Fetches config directly from database (no cache) to ensure accuracy.
 */
export class ProtocolFeeService {
  constructor(private readonly repository: IProtocolFeeRepository) {
    console.log("[ProtocolFeeService] Initialized");
  }

  /**
   * Calculate protocol fee for a given swap amount and provider
   *
   * @param provider - The swap provider (e.g., "thirdweb", "uniswap", "uniswap-trading-api", "uniswap-smart-router")
   * @param amount - The swap amount in wei
   * @returns The protocol fee in wei
   */
  public async calculateFee(provider: string, amount: bigint): Promise<bigint> {
    // Normalize provider name (uniswap-* -> uniswap)
    const normalizedProvider = this.normalizeProvider(provider);

    const config = await this.getFeeConfig(normalizedProvider);

    if (!config || !config.isActive) {
      console.log(
        `[ProtocolFeeService] No active fee config for ${normalizedProvider}, using default`
      );
      // Use default fee if not configured
      const defaultPercentage = DEFAULT_FEE_CONFIGS[normalizedProvider] ?? 0.5;
      const feeScaled = BigInt(Math.round(defaultPercentage * 10000));
      return (amount * feeScaled) / 1000000n;
    }

    const fee = config.calculateFee(amount);
    console.log(
      `[ProtocolFeeService] Calculated fee for ${normalizedProvider}: ${fee.toString()} (${config.taxInPercent}%)`
    );
    return fee;
  }

  /**
   * Get fee configuration for a provider
   */
  public async getFeeConfig(
    provider: string
  ): Promise<ProtocolFeeConfig | null> {
    const normalizedProvider = this.normalizeProvider(provider);

    try {
      return await this.repository.getByProvider(normalizedProvider);
    } catch (error) {
      console.error(
        `[ProtocolFeeService] Error getting fee config for ${normalizedProvider}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get fee percentage for a provider (for display)
   */
  public async getFeePercentage(provider: string): Promise<number> {
    const normalizedProvider = this.normalizeProvider(provider);
    const config = await this.getFeeConfig(normalizedProvider);

    if (!config || !config.isActive) {
      return DEFAULT_FEE_CONFIGS[normalizedProvider] ?? 0.5;
    }

    return config.taxInPercent;
  }

  /**
   * Normalize provider name
   * Maps specific provider names to their base provider
   */
  private normalizeProvider(provider: string): string {
    // Map all uniswap variants to "uniswap"
    if (
      provider.startsWith("uniswap") ||
      provider === "uniswap-trading-api" ||
      provider === "uniswap-smart-router"
    ) {
      return "uniswap";
    }

    return provider;
  }
}
