// Infrastructure Adapters (non-custodial V1)
import { createThirdwebClient, Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import {
  SwapRequest,
  SwapQuote,
  SwapResult,
  SwapTransaction,
  TransactionStatus,
} from "../../domain/entities/swap";
import { ISwapService } from "../../domain/ports/swap.repository";
import { isNativeLike } from "../../utils/native.utils";

export class ThirdwebSwapAdapter implements ISwapService {
  private client: ReturnType<typeof createThirdwebClient>;

  constructor() {
    const clientId = process.env.THIRDWEB_CLIENT_ID;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;

    console.log("[ThirdwebSwapAdapter] Initializing with credentials:");
    console.log(
      "- CLIENT_ID:",
      clientId ? `${clientId.substring(0, 8)}...` : "[NOT SET]"
    );
    console.log("- SECRET_KEY:", secretKey ? "[SET]" : "[NOT SET]");

    if (!clientId) {
      throw new Error("THIRDWEB_CLIENT_ID is required");
    }

    this.client = createThirdwebClient({
      clientId,
      ...(secretKey ? { secretKey } : {}),
    });

    console.log(
      "[ThirdwebSwapAdapter] Initialized successfully (non-custodial mode)"
    );
  }

  public async getQuote(swapRequest: SwapRequest): Promise<SwapQuote> {
    try {
      console.log(
        "[ThirdwebSwapAdapter] Getting quote for:",
        swapRequest.toLogString()
      );

      const sellAmountWei = swapRequest.amount;

      const quote = await Bridge.Sell.quote({
        originChainId: swapRequest.fromChainId,
        originTokenAddress: isNativeLike(swapRequest.fromToken)
          ? NATIVE_TOKEN_ADDRESS
          : swapRequest.fromToken,
        destinationChainId: swapRequest.toChainId,
        destinationTokenAddress: isNativeLike(swapRequest.toToken)
          ? NATIVE_TOKEN_ADDRESS
          : swapRequest.toToken,
        amount: sellAmountWei,
        client: this.client,
      });

      // Observação: aqui não inventamos valores. Mantemos um estimate simples.
      // Você pode enriquecer depois com price impact real quando disponível.
      const originAmount = BigInt(quote.originAmount.toString());
      const destAmount = BigInt(quote.destinationAmount.toString());
      const estMs = quote.estimatedExecutionTimeMs ?? 60_000;

      // Gas/FX simples para MVP (troque quando integrar campos oficiais)
      const estimatedGasFee = BigInt("420000000000000"); // ~0.00042 ETH em wei (placeholder)
      const exchangeRate =
        Number(destAmount) > 0
          ? Number(destAmount) / Number(originAmount)
          : 0.998;

      return new SwapQuote(
        destAmount,
        originAmount > destAmount ? originAmount - destAmount : 0n, // "bridgeFee" aprox
        estimatedGasFee,
        exchangeRate,
        Math.floor(estMs / 1000)
      );
    } catch (error: any) {
      const status = error?.statusCode || error?.status || error?.response?.status;
      const code = error?.code || error?.response?.data?.code;
      const correlationId = error?.correlationId || error?.response?.data?.correlationId;
      console.error("[ThirdwebSwapAdapter] Error getting quote:", {
        message: error?.message,
        status,
        code,
        correlationId,
      });
      const detail = [
        error?.message,
        status ? `status=${status}` : undefined,
        code ? `code=${code}` : undefined,
        correlationId ? `correlationId=${correlationId}` : undefined,
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(`Failed to get quote: ${detail}`);
    }
  }


  public async prepareSwap(swapRequest: SwapRequest): Promise<any> {
    try {
      const payload = {
        originChainId: swapRequest.fromChainId,
        originTokenAddress: isNativeLike(swapRequest.fromToken)
          ? NATIVE_TOKEN_ADDRESS
          : swapRequest.fromToken,
        destinationChainId: swapRequest.toChainId,
        destinationTokenAddress: isNativeLike(swapRequest.toToken)
          ? NATIVE_TOKEN_ADDRESS
          : swapRequest.toToken,
        amount: swapRequest.amount,
        sender: swapRequest.sender,
        receiver: swapRequest.receiver || swapRequest.sender,
        client: this.client,
      } as const;

      if (process.env.DEBUG === "true") {
        console.log("[ThirdwebSwapAdapter] Prepare payload:", {
          originChainId: payload.originChainId,
          originTokenAddress: payload.originTokenAddress,
          destinationChainId: payload.destinationChainId,
          destinationTokenAddress: payload.destinationTokenAddress,
          amount: payload.amount.toString(),
          sender: payload.sender,
          receiver: payload.receiver,
        });
        // Optional preflight quote for debugging
        try {
          const q = await Bridge.Sell.quote({
            originChainId: payload.originChainId,
            originTokenAddress: payload.originTokenAddress,
            destinationChainId: payload.destinationChainId,
            destinationTokenAddress: payload.destinationTokenAddress,
            amount: payload.amount,
            client: this.client,
          });
          console.log("[ThirdwebSwapAdapter] Preflight quote:", {
            originAmount: q.originAmount?.toString?.() ?? String(q.originAmount),
            destinationAmount: q.destinationAmount?.toString?.() ?? String(q.destinationAmount),
            estimatedExecutionTimeMs: q.estimatedExecutionTimeMs,
          });
        } catch (preErr: any) {
          console.log("[ThirdwebSwapAdapter] Preflight quote failed:", {
            message: preErr?.message,
            status: preErr?.statusCode || preErr?.status,
            code: preErr?.code,
            correlationId: preErr?.correlationId,
          });
        }
      }

      const prepared = await Bridge.Sell.prepare(payload);

      // `prepared` normalmente contém { steps: [{ transactions: [...] }], expiresAt, ... }
      return prepared;
    } catch (error: any) {
      const status = error?.statusCode || error?.status || error?.response?.status;
      const code = error?.code || error?.response?.data?.code;
      const correlationId = error?.correlationId || error?.response?.data?.correlationId;
      console.error("[ThirdwebSwapAdapter] Error preparing swap:", {
        message: error?.message,
        status,
        code,
        correlationId,
      });
      const detail = [
        error?.message,
        status ? `status=${status}` : undefined,
        code ? `code=${code}` : undefined,
        correlationId ? `correlationId=${correlationId}` : undefined,
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(`Failed to prepare swap: ${detail}`);
    }
  }

  /**
   * DESABILITADO no V1 non-custodial.
   * Mantido apenas para compatibilidade com interfaces.
   */
  public async executeSwap(_swapRequest: SwapRequest): Promise<SwapResult> {
    throw new Error(
      "Server-side execution is disabled in non-custodial V1. Use prepareSwap() on server and send/sign on the client."
    );
  }

  public async monitorTransaction(
    transactionHash: string,
    chainId: number
  ): Promise<string> {
    try {
      const status = await Bridge.status({
        transactionHash: transactionHash as `0x${string}`,
        chainId,
        client: this.client,
      });

      switch (status.status) {
        case "COMPLETED":
          return TransactionStatus.COMPLETED;
        case "PENDING":
          return TransactionStatus.PENDING;
        case "FAILED":
          return TransactionStatus.FAILED;
        default:
          return TransactionStatus.PENDING;
      }
    } catch (error: any) {
      throw new Error(`Failed to monitor transaction: ${error.message}`);
    }
  }

  // Métodos auxiliares mockados mantidos
  public async getSupportedChains(): Promise<any[]> {
    const supportedChains = [
      {
        chainId: 1,
        name: "Ethereum",
        icon: "",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
      {
        chainId: 137,
        name: "Polygon",
        icon: "",
        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
      },
      {
        chainId: 56,
        name: "BSC",
        icon: "",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      },
      {
        chainId: 8453,
        name: "Base",
        icon: "",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
      {
        chainId: 10,
        name: "Optimism",
        icon: "",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
      {
        chainId: 42161,
        name: "Arbitrum",
        icon: "",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
      {
        chainId: 43114,
        name: "Avalanche",
        icon: "",
        nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
      },
    ];
    console.log(
      `[ThirdwebSwapAdapter] Returning ${supportedChains.length} supported chains`
    );
    return supportedChains;
  }

  public async getSupportedRoutes(
    _originChainId?: number,
    _destinationChainId?: number
  ): Promise<any[]> {
    const mockRoutes = [
      {
        originToken: {
          chainId: 1,
          address: "native",
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
        },
        destinationToken: {
          chainId: 137,
          address: "native",
          symbol: "MATIC",
          name: "Polygon",
          decimals: 18,
        },
      },
      {
        originToken: {
          chainId: 137,
          address: "native",
          symbol: "MATIC",
          name: "Polygon",
          decimals: 18,
        },
        destinationToken: {
          chainId: 1,
          address: "native",
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
        },
      },
    ];
    console.log(
      `[ThirdwebSwapAdapter] Returning ${mockRoutes.length} supported routes`
    );
    return mockRoutes;
  }
}
