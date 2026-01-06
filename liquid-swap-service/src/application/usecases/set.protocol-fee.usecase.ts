// Application Use Cases - Set Protocol Fee
import { IProtocolFeeRepository } from "../../domain/ports/protocol-fee.repository";
import { ProtocolFeeConfig } from "../../domain/entities/protocol-fee";
import { v4 as uuidv4 } from "uuid";

export interface SetProtocolFeeRequest {
  provider: string;
  taxInPercent: number;
  taxInBips?: number;
  taxInEth?: string; // Wei as string
  isActive?: boolean;
  adminAddress: string; // Wallet address of admin making the change
}

export interface SetProtocolFeeResponse {
  success: boolean;
  provider: string;
  taxInPercent: number;
  isActive: boolean;
  message: string;
}

export class SetProtocolFeeUseCase {
  private readonly ALLOWED_ADMINS: string[];

  constructor(private readonly repository: IProtocolFeeRepository) {
    // Load admin addresses from environment
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
    this.ALLOWED_ADMINS = adminAddress ? [adminAddress] : [];

    console.log(
      `[SetProtocolFeeUseCase] Initialized with ${this.ALLOWED_ADMINS.length} admin(s)`
    );
  }

  public async execute(
    request: SetProtocolFeeRequest
  ): Promise<SetProtocolFeeResponse> {
    console.log(
      `[SetProtocolFeeUseCase] Setting fee for ${request.provider}: ${request.taxInPercent}%`
    );

    // TODO: re-enable admin check in production
    // Validate admin authorization
    // if (!this.isAuthorized(request.adminAddress)) {
    //   throw new Error(`Unauthorized: ${request.adminAddress} is not an admin`);
    // }

    // Validate provider
    const validProviders = ["thirdweb", "uniswap"];
    if (!validProviders.includes(request.provider)) {
      throw new Error(
        `Invalid provider: ${request.provider}. Must be one of: ${validProviders.join(", ")}`
      );
    }

    // Validate fee percentage (0-10% limit for safety)
    if (request.taxInPercent < 0 || request.taxInPercent > 10) {
      throw new Error(
        `Tax percentage must be between 0 and 10. Received: ${request.taxInPercent}`
      );
    }

    // Check if config exists
    const exists = await this.repository.exists(request.provider);

    const config = new ProtocolFeeConfig(
      exists ? request.provider : uuidv4(),
      request.provider,
      request.taxInPercent,
      request.isActive ?? true,
      request.taxInBips ?? null,
      request.taxInEth ? BigInt(request.taxInEth) : null
    );

    if (exists) {
      await this.repository.save(config);
    } else {
      await this.repository.create(config);
    }

    console.log(
      `[SetProtocolFeeUseCase] Fee ${exists ? "updated" : "created"} successfully for ${request.provider}`
    );

    return {
      success: true,
      provider: request.provider,
      taxInPercent: request.taxInPercent,
      isActive: config.isActive,
      message: `Protocol fee for ${request.provider} ${exists ? "updated" : "created"} to ${request.taxInPercent}%`,
    };
  }

  private isAuthorized(address: string): boolean {
    // If no admins configured, allow all (development mode)
    if (this.ALLOWED_ADMINS.length === 0) {
      console.warn(
        "[SetProtocolFeeUseCase] No admins configured, allowing all (dev mode)"
      );
      return true;
    }

    return this.ALLOWED_ADMINS.includes(address.toLowerCase());
  }
}
