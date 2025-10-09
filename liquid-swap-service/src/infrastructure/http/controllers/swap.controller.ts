import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express-serve-static-core";

import { GetQuoteUseCase } from "../../../application/usecases/get.quote.usecase";
import {
  ExecuteSwapUseCase,
  GetSwapHistoryUseCase,
} from "../../../application/usecases/execute.swap.usecase";
import { PrepareSwapUseCase } from "../../../application/usecases/prepare.swap.usecase";
import { GetSwapStatusUseCase } from "../../../application/usecases/get.status.usecase";

// Alias dos tipos base
type Request = ExpressRequest;
type Response = ExpressResponse;

// Tipagem local para acessar req.user (endereço do usuário autenticado)
type RequestWithUser = Request & {
  user?: { address: string; [k: string]: any };
};

export class SwapController {
  constructor(
    private readonly getQuoteUseCase: GetQuoteUseCase,
    private readonly prepareSwapUseCase: PrepareSwapUseCase,
    private readonly executeSwapUseCase: ExecuteSwapUseCase,
    private readonly getSwapHistoryUseCase: GetSwapHistoryUseCase,
    private readonly getSwapStatusUseCase: GetSwapStatusUseCase
  ) {}

  public getQuote = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap quote");

      const { fromChainId, toChainId, fromToken, toToken, amount, smartAccountAddress } =
        (req.body ?? {}) as {
          fromChainId?: number;
          toChainId?: number;
          fromToken?: string;
          toToken?: string;
          amount?: string;
          smartAccountAddress?: string;
        };

      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount || !smartAccountAddress) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: [
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "smartAccountAddress"
          ],
        });
      }

      const sender = smartAccountAddress
      console.log(`[SwapController] Getting quote for user: ${sender}`);
      if (!sender) throw new Error("Missing smartAccountAddress");
      const quote = await this.getQuoteUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
      });

      return res.json({
        success: true,
        quote,
        // NOVO: informar provider usado
        metadata: {
          provider: quote.provider, // 'uniswap' ou 'thirdweb'
          routingStrategy: 'auto',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("[SwapController] Error getting quote:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  /**
   * Retorna o bundle "prepared" (approve? + swap) para o cliente assinar.
   */
  public getPreparedTx = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      console.log("[SwapController] Preparing swap (bundle)");

      const { fromChainId, toChainId, fromToken, toToken, amount, sender } =
        (req.body ?? {}) as {
          fromChainId?: number;
          toChainId?: number;
          fromToken?: string;
          toToken?: string;
          amount?: string;
          sender?: string;
        };

      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount || !sender) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: [
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "sender"
          ],
        });
      }

      const receiver = sender

      const { prepared } = await this.prepareSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver,
      });

      const serializedPrepared = this.serializeBigInt(prepared);

      return res.json({ success: true, prepared: serializedPrepared });
    } catch (error) {
      console.error("[SwapController] Error preparing swap:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  private serializeBigInt = (obj: any) => {
    return JSON.parse(JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  };

  /**
   * Mantido por compatibilidade; retorna 501 no V1 non-custodial.
   */
  public executeSwap = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      if (process.env.ENGINE_ENABLED !== "true") {
        return res.status(501).json({
          error: "Server-side execution disabled",
          message:
            "Set ENGINE_ENABLED=true to enable server-side execution via Engine.",
        });
      }

      const {
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        smartAccountAddress,
        receiver,
      } = (req.body ?? {}) as {
        fromChainId?: number;
        toChainId?: number;
        fromToken?: string;
        toToken?: string;
        amount?: string;
        smartAccountAddress?: string;
        receiver?: string;
      };

      if (
        !fromChainId ||
        !toChainId ||
        !fromToken ||
        !toToken ||
        !amount ||
        !smartAccountAddress
      ) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: [
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "smartAccountAddress",
          ],
        });
      }

      const sender = smartAccountAddress;
      if (!sender) throw new Error("Missing user's smart account address")
      
      const signerAddress = process.env.ADMIN_WALLET_ADDRESS;
      if (!signerAddress) throw new Error("Missing backend wallet address")

      if (process.env.DEBUG === "true") {
        console.log("[SwapController] Execute payload:", {
          fromChainId,
          toChainId,
          fromToken,
          toToken,
          amount,
          sender,
          receiver: receiver || sender,
        });
      }

      const resp = await this.executeSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver,
        signerAddress,
      });

      return res.json(resp);
    } catch (error) {
      console.error("[SwapController] Error executing swap:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  public getSwapHistory = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap history");

      const aReq = req as RequestWithUser;
      const { userAddress } = (req.params ?? {}) as { userAddress?: string };

      let targetAddress = userAddress;
      if (!targetAddress) {
        if (!aReq.user?.address) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "User address not found in authentication token",
          });
        }
        targetAddress = aReq.user.address;
      }

      if (aReq.user?.address && targetAddress !== aReq.user.address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only access your own swap history",
        });
      }

      const history = await this.getSwapHistoryUseCase.execute(targetAddress!);

      return res.json({
        success: true,
        data: {
          userAddress: targetAddress,
          swaps: history.map((swap) => ({
            transactions: swap.transactions.map((tx) => ({
              hash: tx.hash,
              chainId: tx.chainId,
              status: tx.status,
            })),
            startTime: swap.startTime,
            endTime: swap.endTime,
            duration: swap.getDuration(),
          })),
        },
      });
    } catch (error) {
      console.error("[SwapController] Error getting swap history:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  public getStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap status");

      const { transactionHash } = (req.params ?? {}) as {
        transactionHash?: string;
      };
      if (!transactionHash) {
        return res.status(400).json({
          error: "Missing transaction hash",
          requiredParams: ["transactionHash"],
        });
      }

      const aReq = req as RequestWithUser;
      if (!aReq.user?.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token",
        });
      }

      const chainIdRaw = (req.query?.chainId as string) || "";
      const chainId = Number(chainIdRaw);
      if (!chainId || Number.isNaN(chainId)) {
        return res.status(400).json({
          error: "Missing or invalid chainId",
          requiredQuery: ["chainId"],
        });
      }

      const out = await this.getSwapStatusUseCase.execute({
        transactionHash,
        chainId,
      });

      return res.json({ success: true, data: { ...out, userAddress: aReq.user.address } });
    } catch (error) {
      console.error("[SwapController] Error getting swap status:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };
}
