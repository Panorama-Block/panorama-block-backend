import type {
  NextFunction,
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
import {
  SwapError,
  SwapErrorCode,
  createForbiddenError,
  createMissingParamsError,
  createServiceUnavailableError,
  createUnauthorizedError,
} from "../../../domain/entities/errors";

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

  public getQuote = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
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
        return next(
          createMissingParamsError([
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "smartAccountAddress",
          ])
        );
      }

      const sender = smartAccountAddress
      console.log(`[SwapController] Getting quote for user: ${sender}`);
      if (!sender) {
        return next(createMissingParamsError(["smartAccountAddress"]));
      }
      const quote = await this.getQuoteUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
      });

      console.log(`[SwapController] Quote obtained from provider: ${quote.provider}`);
      return res.json({ success: true, quote });
    } catch (error) {
      console.error("[SwapController] Error getting quote:", error);
      return next(error);
    }
  };

  /**
   * Retorna o bundle "prepared" (approve? + swap) para o cliente assinar.
   */
  public getPreparedTx = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
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
        return next(
          createMissingParamsError([
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "sender",
          ])
        );
      }

      const receiver = sender

      const { prepared, provider } = await this.prepareSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver,
      });

      const serializedPrepared = this.serializeBigInt(prepared);

      console.log(`[SwapController] Swap prepared using provider: ${provider}`);
      return res.json({ success: true, prepared: serializedPrepared, provider });
    } catch (error) {
      console.error("[SwapController] Error preparing swap:", error);
      return next(error);
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
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (process.env.ENGINE_ENABLED !== "true") {
        return next(
          createServiceUnavailableError(
            "Server-side execution disabled (ENGINE_ENABLED !== true)"
          )
        );
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
        return next(
          createMissingParamsError([
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amount",
            "smartAccountAddress",
          ])
        );
      }

      const sender = smartAccountAddress;
      if (!sender) {
        return next(createMissingParamsError(["smartAccountAddress"]));
      }
      
      const signerAddress = process.env.ADMIN_WALLET_ADDRESS;
      if (!signerAddress) {
        return next(
          createServiceUnavailableError(
            "Missing backend wallet address configuration"
          )
        );
      }

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
      return next(error);
    }
  };

  public getSwapHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      console.log("[SwapController] Getting swap history");

      const aReq = req as RequestWithUser;
      const { userAddress } = (req.params ?? {}) as { userAddress?: string };

      let targetAddress = userAddress;
      if (!targetAddress) {
        if (!aReq.user?.address) {
          return next(
            createUnauthorizedError(
              "User address not found in authentication token"
            )
          );
        }
        targetAddress = aReq.user.address;
      }

      if (aReq.user?.address && targetAddress !== aReq.user.address) {
        return next(
          createForbiddenError("You can only access your own swap history")
        );
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
      return next(error);
    }
  };

  public getStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      console.log("[SwapController] Getting swap status");

      const { transactionHash } = (req.params ?? {}) as {
        transactionHash?: string;
      };
      if (!transactionHash) {
        return next(createMissingParamsError(["transactionHash"]));
      }

      const aReq = req as RequestWithUser;
      if (!aReq.user?.address) {
        return next(
          createUnauthorizedError(
            "User address not found in authentication token"
          )
        );
      }

      const chainIdRaw = (req.query?.chainId as string) || "";
      const chainId = Number(chainIdRaw);
      if (!chainId || Number.isNaN(chainId)) {
        return next(
          new SwapError(
            SwapErrorCode.INVALID_REQUEST,
            "Missing or invalid chainId",
            { provided: chainIdRaw }
          )
        );
      }

      const out = await this.getSwapStatusUseCase.execute({
        transactionHash,
        chainId,
      });

      return res.json({ success: true, data: { ...out, userAddress: aReq.user.address } });
    } catch (error) {
      console.error("[SwapController] Error getting swap status:", error);
      return next(error);
    }
  };
}
