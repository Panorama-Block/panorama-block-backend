// Application Use Cases
import { SwapRequest } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";
import { getTokenSpotUsdPrice } from "../services/price.service";
import { getTokenDecimals, toWei } from "../../utils/token.utils";

export interface GetQuoteUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string; // humano (unit=token) ou WEI (unit=wei)
  unit?: "token" | "wei";
  sender: string;
}

export interface GetQuoteUseCaseResponse {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;                  // WEI
  amountHuman?: string;            // token units
  amountUsd?: string;
  estimatedReceiveAmount: string;
  estimatedReceiveAmountUsd?: string;
  estimatedDuration: number;
  exchangeRate: number;
  fees: {
    bridgeFee: string;
    gasFee: string;
    totalFee: string;
    totalFeeUsd?: string;
  };
}

export class GetQuoteUseCase {
  constructor(private readonly swapDomainService: SwapDomainService) {}

  public async execute(request: GetQuoteUseCaseRequest): Promise<GetQuoteUseCaseResponse> {
    try {
      console.log(`[GetQuoteUseCase] Getting quote for swap`);

      const unit = request.unit || "token";
      const fromDecimals = await getTokenDecimals(request.fromChainId, request.fromToken);
      const toDecimals = await getTokenDecimals(request.toChainId, request.toToken);
      const amountWei = unit === "wei" ? BigInt(request.amount) : toWei(request.amount, fromDecimals);

      // Convert to domain entity
      const swapRequest = new SwapRequest(
        request.fromChainId,
        request.toChainId,
        request.fromToken,
        request.toToken,
        amountWei,
        request.sender,
        request.sender // For quote, receiver is same as sender
      );

      // Get quote through domain service (without executing)
      const quote = await this.swapDomainService.getQuote(swapRequest);

      // Enriquecimento USD via thirdweb
      const fromUsd = await getTokenSpotUsdPrice(request.fromChainId, request.fromToken);
      const toUsd = await getTokenSpotUsdPrice(request.toChainId, request.toToken);
      const amountHuman = unit === "token" ? request.amount : undefined;
      const amountUsd = fromUsd && amountHuman ? (Number(amountHuman) * fromUsd).toFixed(2) : undefined;

      const estimatedReceiveAmountUsd = (() => {
        if (!toUsd) return undefined;
        const n = Number(quote.estimatedReceiveAmount.toString()) / 10 ** toDecimals;
        return (n * toUsd).toFixed(2);
      })();

      const totalFeeUsd = (() => {
        if (!fromUsd) return undefined;
        const n = Number(quote.getTotalFees().toString()) / 10 ** fromDecimals;
        return (n * fromUsd).toFixed(2);
      })();

      return {
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: amountWei.toString(),
        amountHuman,
        amountUsd,
        estimatedReceiveAmount: quote.estimatedReceiveAmount.toString(),
        estimatedReceiveAmountUsd,
        estimatedDuration: quote.estimatedDuration,
        exchangeRate: quote.exchangeRate,
        fees: {
          bridgeFee: quote.bridgeFee.toString(),
          gasFee: quote.gasFee.toString(),
          totalFee: quote.getTotalFees().toString(),
          totalFeeUsd
        }
      };

    } catch (error) {
      console.error(`[GetQuoteUseCase] Error getting quote:`, error);
      throw error;
    }
  }
} 