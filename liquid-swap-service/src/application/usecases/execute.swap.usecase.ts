// Application Use Cases
import { SwapRequest, SwapResult } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";

export interface ExecuteSwapUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  sender: string;
  receiver: string;
}

export interface ExecuteSwapUseCaseResponse {
  success: boolean;
  transactionHashes: string[];
  estimatedDuration: number;
  message: string;
}

export class ExecuteSwapUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(request: ExecuteSwapUseCaseRequest): Promise<ExecuteSwapUseCaseResponse> {
    try {
      console.log(`[ExecuteSwapUseCase] Executing swap use case`);

      // Convert to domain entity
      const swapRequest = new SwapRequest(
        request.fromChainId,
        request.toChainId,
        request.fromToken,
        request.toToken,
        BigInt(request.amount),
        request.sender,
        request.receiver
      );

      // Process swap through domain service
      const result = await this.swapDomainService.processSwap(swapRequest);

      return {
        success: true,
        transactionHashes: result.transactions.map(tx => tx.hash),
        estimatedDuration: result.quote.estimatedDuration,
        message: "Swap executed successfully"
      };

    } catch (error) {
      console.error(`[ExecuteSwapUseCase] Error executing swap:`, error);
      throw error;
    }
  }
}

export class GetSwapHistoryUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(userAddress: string): Promise<SwapResult[]> {
    try {
      console.log(`[GetSwapHistoryUseCase] Getting swap history for ${userAddress}`);
      return await this.swapDomainService.getSwapHistory(userAddress);
    } catch (error) {
      console.error(`[GetSwapHistoryUseCase] Error getting swap history:`, error);
      throw error;
    }
  }
} 