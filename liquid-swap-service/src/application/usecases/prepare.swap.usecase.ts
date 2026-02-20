// Application Use Cases - Prepare Swap (V1 non-custodial)
import { SwapRequest } from "../../domain/entities/swap";
import { ProviderSelectorService } from "../services/provider-selector.service";
import { normalizeToNative } from "../../utils/native.utils";
import { getTokenDecimals, toWei } from "../../utils/token.utils";

export interface PrepareSwapUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string; // unit="token" => token units (decimal string); unit="wei" => base units (integer string)
  unit?: "token" | "wei";
  sender: string;
  receiver?: string;
  provider?: string; // Optional: specify provider to use (default: auto-select best)
}

export interface PrepareSwapUseCaseResponse {
  prepared: any; // objeto retornado pelo provider (steps/transactions/expiresAt)
  provider: string; // Provider name that was used
}

export class PrepareSwapUseCase {
  constructor(private readonly providerSelectorService: ProviderSelectorService) {}

  public async execute(
    req: PrepareSwapUseCaseRequest
  ): Promise<PrepareSwapUseCaseResponse> {
    const fromTok = normalizeToNative(req.fromToken);
    const toTok = normalizeToNative(req.toToken);
    const unit = req.unit || "wei";
    const fromDecimals = await getTokenDecimals(req.fromChainId, fromTok);
    const amountWei = unit === "wei" ? BigInt(req.amount) : toWei(req.amount, fromDecimals);
    const swapRequest = new SwapRequest(
      req.fromChainId,
      req.toChainId,
      fromTok,
      toTok,
      amountWei,
      req.sender,
      req.receiver || req.sender
    );

    // Use specified provider or auto-select best provider
    const result = await this.providerSelectorService.prepareSwapWithProvider(
      swapRequest,
      req.provider
    );

    console.log(`[PrepareSwapUseCase] Swap prepared using provider: ${result.provider}`);

    return result;
  }
}
