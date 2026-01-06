// Domain Ports - Protocol Fee Repository Interface
import { ProtocolFeeConfig } from "../entities/protocol-fee";

export interface IProtocolFeeRepository {
  /**
   * Get fee configuration for a specific provider
   */
  getByProvider(provider: string): Promise<ProtocolFeeConfig | null>;

  /**
   * Get all active fee configurations
   */
  getAllActive(): Promise<ProtocolFeeConfig[]>;

  /**
   * Save or update fee configuration
   */
  save(config: ProtocolFeeConfig): Promise<void>;

  /**
   * Create initial fee configuration for a provider
   */
  create(config: ProtocolFeeConfig): Promise<void>;

  /**
   * Check if provider configuration exists
   */
  exists(provider: string): Promise<boolean>;
}
