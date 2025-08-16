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
    private readonly getSwapHistoryUseCase: GetSwapHistoryUseCase
  ) {}

  public getQuote = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap quote");

      const { fromChainId, toChainId, fromToken, toToken, amount } =
        (req.body ?? {}) as {
          fromChainId?: number;
          toChainId?: number;
          fromToken?: string;
          toToken?: string;
          amount?: string;
        };

      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: [
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
          ],
        });
      }

      const aReq = req as RequestWithUser;
      if (!aReq.user?.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token",
        });
      }

      const sender = aReq.user.address;
      console.log(`[SwapController] Getting quote for user: ${sender}`);

      const quote = await this.getQuoteUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
      });

      return res.json({ success: true, quote });
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

      const { fromChainId, toChainId, fromToken, toToken, amount, receiver } =
        (req.body ?? {}) as {
          fromChainId?: number;
          toChainId?: number;
          fromToken?: string;
          toToken?: string;
          amount?: string;
          receiver?: string;
        };

      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: [
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
          ],
        });
      }

      const aReq = req as RequestWithUser;
      if (!aReq.user?.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token",
        });
      }

      const sender = aReq.user.address;

      const { prepared } = await this.prepareSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver,
      });

      return res.json({ success: true, prepared });
    } catch (error) {
      console.error("[SwapController] Error preparing swap:", error);
      return res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  /**
   * Mantido por compatibilidade; retorna 501 no V1 non-custodial.
   */
  public executeSwap = async (
    _req: Request,
    res: Response
  ): Promise<Response> => {
    return res.status(501).json({
      error: "Server-side execution disabled",
      message:
        "Use /swap/tx para obter o bundle e assine no cliente. A execução no servidor é desativada no V1 non-custodial.",
    });
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

      // TODO: integrar com monitor real (adapter.monitorTransaction)
      return res.json({
        success: true,
        data: {
          transactionHash,
          status: "pending",
          userAddress: aReq.user.address,
        },
      });
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
