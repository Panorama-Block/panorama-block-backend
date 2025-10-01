import { SwapDomainService } from "../../domain/services/swap.domain.service";

export interface GetSwapStatusRequest {
  transactionHash: string;
  chainId: number;
}

export interface GetSwapStatusResponse {
  transactionHash: string;
  chainId: number;
  status: string;
}

export class GetSwapStatusUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(req: GetSwapStatusRequest): Promise<GetSwapStatusResponse> {
    const status = await this.swapDomainService.monitorStatus(req.transactionHash, req.chainId);
    return { transactionHash: req.transactionHash, chainId: req.chainId, status };
  }
}

