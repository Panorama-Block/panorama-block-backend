// Application Use Cases - Prepare Swap (V1 non-custodial)
import { SwapRequest } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";

export interface PrepareSwapUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string; // WEI (string) ou token human se você quiser adaptar
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
    const swapRequest = new SwapRequest(
      req.fromChainId,
      req.toChainId,
      req.fromToken,
      req.toToken,
      BigInt(req.amount),
      req.sender,
      req.receiver || req.sender
    );

    const prepared = await this.swapDomainService.prepareSwap(swapRequest);
    return { prepared };
  }
}
