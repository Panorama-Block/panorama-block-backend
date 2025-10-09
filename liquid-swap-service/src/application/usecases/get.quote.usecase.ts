// Application Use Cases
import { SwapRequest } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";
import { ProviderSelectorService } from "../services/provider-selector.service";
import { getTokenSpotUsdPrice } from "../services/price.service";
import { getTokenDecimals, toWei } from "../../utils/token.utils";
import { normalizeToNative } from "../../utils/native.utils";

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
  provider: string; // NOVO campo - informar frontend qual provider foi usado
}

export class GetQuoteUseCase {
  constructor(
    private readonly swapDomainService: SwapDomainService,
    private readonly providerSelector: ProviderSelectorService
  ) {}

  public async execute(request: GetQuoteUseCaseRequest): Promise<GetQuoteUseCaseResponse> {
    try {
      console.log(`[GetQuoteUseCase] Getting quote for swap`);

      const unit = request.unit || "token";
      const fromTok = normalizeToNative(request.fromToken);
      const toTok = normalizeToNative(request.toToken);
      const fromDecimals = await getTokenDecimals(request.fromChainId, fromTok);
      const toDecimals = await getTokenDecimals(request.toChainId, toTok);
      const amountWei = unit === "wei" ? BigInt(request.amount) : toWei(request.amount, fromDecimals);

      // Convert to domain entity
      const swapRequest = new SwapRequest(
        request.fromChainId,
        request.toChainId,
        fromTok,
        toTok,
        amountWei,
        request.sender,
        request.sender // For quote, receiver is same as sender
      );

      // MODIFICAR: Usar provider selector ao invés de swapDomainService diretamente
      const { provider, quote } = await this.providerSelector.getQuoteWithBestProvider(swapRequest);

      console.log(`[GetQuoteUseCase] ✅ Selected provider: ${provider}`);

      // Enriquecimento USD via thirdweb
      const fromUsd = await getTokenSpotUsdPrice(request.fromChainId, fromTok);
      const toUsd = await getTokenSpotUsdPrice(request.toChainId, toTok);
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
        fromToken: fromTok,
        toToken: toTok,
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
        },
        provider // NOVO campo - informar frontend qual provider foi usado
      };

    } catch (error) {
      console.error(`[GetQuoteUseCase] Error getting quote:`, error);
      throw error;
    }
  }
} 
