// Application Use Cases
import { SwapRequest } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";

export interface GetQuoteUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  sender: string;
}

export interface GetQuoteUseCaseResponse {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  estimatedReceiveAmount: string;
  estimatedDuration: number;
  exchangeRate: number;
  fees: {
    bridgeFee: string;
    gasFee: string;
    totalFee: string;
  };
}

export class GetQuoteUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(request: GetQuoteUseCaseRequest): Promise<GetQuoteUseCaseResponse> {
    try {
      console.log(`[GetQuoteUseCase] Getting quote for swap`);

      // Convert to domain entity
      const swapRequest = new SwapRequest(
        request.fromChainId,
        request.toChainId,
        request.fromToken,
        request.toToken,
        BigInt(request.amount),
        request.sender,
        request.sender // For quote, receiver is same as sender
      );

      // Get quote through domain service (without executing)
      const quote = await this.swapDomainService.getQuote(swapRequest);

      return {
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: request.amount,
        estimatedReceiveAmount: quote.estimatedReceiveAmount.toString(),
        estimatedDuration: quote.estimatedDuration,
        exchangeRate: quote.exchangeRate,
        fees: {
          bridgeFee: quote.bridgeFee.toString(),
          gasFee: quote.gasFee.toString(),
          totalFee: quote.getTotalFees().toString()
        }
      };

    } catch (error) {
      console.error(`[GetQuoteUseCase] Error getting quote:`, error);
      throw error;
    }
  }
} 