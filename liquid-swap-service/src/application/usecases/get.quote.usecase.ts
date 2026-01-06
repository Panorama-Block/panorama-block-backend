// Application Use Cases
import { SwapRequest } from "../../domain/entities/swap";
import { ProviderSelectorService } from "../services/provider-selector.service";
import { ProtocolFeeService } from "../services/protocol-fee.service";
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
    protocolFee: string;           // Protocol fee (Panorama)
    protocolFeePercentage: number; // Fee percentage
    totalFee: string;
    totalFeeUsd?: string;
  };
  provider: string;                // Provider name (uniswap, thirdweb, etc)
}

export class GetQuoteUseCase {
  constructor(
    private readonly providerSelectorService: ProviderSelectorService,
    private readonly protocolFeeService?: ProtocolFeeService
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

      // Get quote through provider selector (automatically selects best provider)
      const { quote, provider } = await this.providerSelectorService.getQuoteWithBestProvider(swapRequest);

      console.log(`[GetQuoteUseCase] Quote obtained from provider: ${provider}`);

      // Calculate protocol fee (Panorama fee)
      let protocolFee = 0n;
      let protocolFeePercentage = 0;
      if (this.protocolFeeService) {
        protocolFee = await this.protocolFeeService.calculateFee(provider, amountWei);
        protocolFeePercentage = await this.protocolFeeService.getFeePercentage(provider);
        console.log(`[GetQuoteUseCase] Protocol fee: ${protocolFee.toString()} (${protocolFeePercentage}%)`);
      }

      // Create quote with protocol fee included
      const quoteWithFee = quote.withProtocolFee(protocolFee);

      // Enriquecimento USD via thirdweb
      const fromUsd = await getTokenSpotUsdPrice(request.fromChainId, fromTok);
      const toUsd = await getTokenSpotUsdPrice(request.toChainId, toTok);
      const amountHuman = unit === "token" ? request.amount : undefined;
      const amountUsd = fromUsd && amountHuman ? (Number(amountHuman) * fromUsd).toFixed(2) : undefined;

      const estimatedReceiveAmountUsd = (() => {
        if (!toUsd) return undefined;
        const n = Number(quoteWithFee.estimatedReceiveAmount.toString()) / 10 ** toDecimals;
        return (n * toUsd).toFixed(2);
      })();

      const totalFeeUsd = (() => {
        if (!fromUsd) return undefined;
        const n = Number(quoteWithFee.getTotalFees().toString()) / 10 ** fromDecimals;
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
        estimatedReceiveAmount: quoteWithFee.estimatedReceiveAmount.toString(),
        estimatedReceiveAmountUsd,
        estimatedDuration: quoteWithFee.estimatedDuration,
        exchangeRate: quoteWithFee.exchangeRate,
        fees: {
          bridgeFee: quoteWithFee.bridgeFee.toString(),
          gasFee: quoteWithFee.gasFee.toString(),
          protocolFee: quoteWithFee.protocolFee.toString(),
          protocolFeePercentage,
          totalFee: quoteWithFee.getTotalFees().toString(),
          totalFeeUsd
        },
        provider
      };

    } catch (error) {
      console.error(`[GetQuoteUseCase] Error getting quote:`, error);
      throw error;
    }
  }
} 
