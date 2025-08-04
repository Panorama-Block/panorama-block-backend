import { Request, Response } from "express";
import { GetQuoteUseCase } from "../../../application/usecases/get.quote.usecase";
import { ExecuteSwapUseCase, GetSwapHistoryUseCase } from "../../../application/usecases/execute.swap.usecase";

export class SwapController {
  constructor(
    private readonly getQuoteUseCase: GetQuoteUseCase,
    private readonly executeSwapUseCase: ExecuteSwapUseCase,
    private readonly getSwapHistoryUseCase: GetSwapHistoryUseCase
  ) {}

  public getQuote = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap quote");

      const {
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount
      } = req.body;

      // Validate required parameters
      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: ["fromChainId", "toChainId", "fromToken", "toToken", "amount"]
        });
      }

      // Get sender from JWT token (authenticated user)
      if (!req.user || !req.user.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token"
        });
      }

      const sender = req.user.address;

      console.log(`[SwapController] Getting quote for user: ${sender}`);

      // Use dedicated quote use case
      const quote = await this.getQuoteUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender
      });

      return res.json({
        success: true,
        quote: quote
      });

    } catch (error) {
      console.error("[SwapController] Error getting quote:", error);
      
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  };

  public executeSwap = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Executing swap request");

      const {
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        receiver // receiver é opcional - se não fornecido, usa o mesmo endereço do sender
      } = req.body;

      // Validate required parameters
      if (!fromChainId || !toChainId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          error: "Missing required parameters",
          requiredParams: ["fromChainId", "toChainId", "fromToken", "toToken", "amount"]
        });
      }

      // Get sender from JWT token (authenticated user)
      if (!req.user || !req.user.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token"
        });
      }

      const sender = req.user.address;
      const finalReceiver = receiver || sender; // Use sender as receiver if not specified

      console.log(`[SwapController] Processing swap for user: ${sender}`);
      console.log(`[SwapController] Receiver: ${finalReceiver}`);

      const result = await this.executeSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver: finalReceiver
      });

      return res.json({
        success: true,
        message: result.message,
        data: {
          transactionHashes: result.transactionHashes,
          estimatedDuration: result.estimatedDuration,
          sender,
          receiver: finalReceiver
        }
      });

    } catch (error) {
      console.error("[SwapController] Error executing swap:", error);
      
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  };

  public getSwapHistory = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap history");

      const { userAddress } = req.params;

      // Se userAddress não for fornecido, usar o endereço do usuário autenticado
      let targetAddress = userAddress;
      
      if (!targetAddress) {
        if (!req.user || !req.user.address) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "User address not found in authentication token"
          });
        }
        targetAddress = req.user.address;
      }

      // Verificar se o usuário pode acessar o histórico solicitado
      if (req.user && req.user.address && targetAddress !== req.user.address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only access your own swap history"
        });
      }

      const history = await this.getSwapHistoryUseCase.execute(targetAddress);

      return res.json({
        success: true,
        data: {
          userAddress: targetAddress,
          swaps: history.map(swap => ({
            transactions: swap.transactions.map(tx => ({
              hash: tx.hash,
              chainId: tx.chainId,
              status: tx.status
            })),
            startTime: swap.startTime,
            endTime: swap.endTime,
            duration: swap.getDuration()
          }))
        }
      });

    } catch (error) {
      console.error("[SwapController] Error getting swap history:", error);
      
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  };

  public getStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log("[SwapController] Getting swap status");

      const { transactionHash } = req.params;

      if (!transactionHash) {
        return res.status(400).json({
          error: "Missing transaction hash",
          requiredParams: ["transactionHash"]
        });
      }

      // Get sender from JWT token (authenticated user)
      if (!req.user || !req.user.address) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User address not found in authentication token"
        });
      }

      // TODO: Implement transaction status check
      // This should call a domain service to check transaction status
      
      return res.json({
        success: true,
        data: {
          transactionHash,
          status: "pending", // TODO: Get real status from blockchain
          userAddress: req.user.address
        }
      });

    } catch (error) {
      console.error("[SwapController] Error getting swap status:", error);
      
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  };
} 