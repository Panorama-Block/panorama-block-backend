// Application Use Cases - Prepare Swap (V1 non-custodial)
import { SwapRequest } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";
import { getTokenDecimals, toWei } from "../../utils/token.utils";

export interface PrepareSwapUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string; // humano (token units) quando unit = "token"; WEI quando unit = "wei"
  unit?: "token" | "wei";
  sender: string;
  receiver?: string;
}

export interface PrepareSwapUseCaseResponse {
  prepared: any; // objeto retornado pelo thirdweb Bridge.Sell.prepare (steps/transactions/expiresAt)
}

export class PrepareSwapUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(
    req: PrepareSwapUseCaseRequest
  ): Promise<PrepareSwapUseCaseResponse> {
    const unit = req.unit || "wei";
    let amountWei: bigint;
    if (unit === "wei") {
      amountWei = BigInt(req.amount);
    } else {
      const fromDecimals = await getTokenDecimals(req.fromChainId, req.fromToken);
      amountWei = toWei(req.amount, fromDecimals);
    }

    const swapRequest = new SwapRequest(
      req.fromChainId,
      req.toChainId,
      req.fromToken,
      req.toToken,
      amountWei,
      req.sender,
      req.receiver || req.sender
    );

    const prepared = await this.swapDomainService.prepareSwap(swapRequest);
    return { prepared };
  }
}
