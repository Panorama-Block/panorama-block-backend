// Application Use Cases - Get Protocol Fee
import { IProtocolFeeRepository } from "../../domain/ports/protocol-fee.repository";
import { DEFAULT_FEE_CONFIGS } from "../../domain/entities/protocol-fee";

export interface GetProtocolFeeRequest {
  provider?: string; // Optional: get specific provider, or all if not specified
}

export interface ProtocolFeeResponse {
  provider: string;
  taxInPercent: number;
  taxInBips: number | null;
  taxInEth: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface GetProtocolFeeResponse {
  fees: ProtocolFeeResponse[];
}

export class GetProtocolFeeUseCase {
  constructor(private readonly repository: IProtocolFeeRepository) {}

  public async execute(
    request: GetProtocolFeeRequest
  ): Promise<GetProtocolFeeResponse> {
    console.log("[GetProtocolFeeUseCase] Getting protocol fees");

    if (request.provider) {
      // Get specific provider
      const config = await this.repository.getByProvider(request.provider);

      if (!config) {
        // Return default if not configured
        return {
          fees: [
            {
              provider: request.provider,
              taxInPercent: DEFAULT_FEE_CONFIGS[request.provider] ?? 0.5,
              taxInBips: null,
              taxInEth: null,
              isActive: true,
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      }

      return {
        fees: [
          {
            provider: config.provider,
            taxInPercent: config.taxInPercent,
            taxInBips: config.taxInBips,
            taxInEth: config.taxInEth?.toString() ?? null,
            isActive: config.isActive,
            updatedAt: config.updatedAt.toISOString(),
          },
        ],
      };
    }

    // Get all active configs
    const configs = await this.repository.getAllActive();

    // Include defaults for providers not in database
    const allProviders = ["thirdweb", "uniswap"];
    const configuredProviders = configs.map((c) => c.provider);

    const fees: ProtocolFeeResponse[] = configs.map((config) => ({
      provider: config.provider,
      taxInPercent: config.taxInPercent,
      taxInBips: config.taxInBips,
      taxInEth: config.taxInEth?.toString() ?? null,
      isActive: config.isActive,
      updatedAt: config.updatedAt.toISOString(),
    }));

    // Add defaults for unconfigured providers
    for (const provider of allProviders) {
      if (!configuredProviders.includes(provider)) {
        fees.push({
          provider,
          taxInPercent: DEFAULT_FEE_CONFIGS[provider] ?? 0.5,
          taxInBips: null,
          taxInEth: null,
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return { fees };
  }
}
