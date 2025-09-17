// Application Use Cases
import { SwapRequest, SwapResult } from "../../domain/entities/swap";
import { SwapDomainService } from "../../domain/services/swap.domain.service";
import { IExecutionPort, PreparedOriginTx } from "../../domain/ports/execution.port";

export interface ExecuteSwapUseCaseRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  sender: string;
  receiver?: string;
  signerAddress: string;
}

export interface ExecuteSwapUseCaseResponse {
  success: boolean;
  transactionHashes: string[];
  estimatedDuration: number;
  message: string;
}

export class ExecuteSwapUseCase {
  constructor(
    private readonly swapDomainService: SwapDomainService,
    private readonly executionPort: IExecutionPort
  ) {}

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
        request.receiver || request.sender
      );

      // Prepare route/transactions on origin chain
      const prepared: any = await this.swapDomainService.prepareSwap(swapRequest);

      // Extract origin transactions from prepared object
      const txs: PreparedOriginTx[] = [];
      if (Array.isArray(prepared?.transactions)) {
        for (const t of prepared.transactions) {
          if (t?.to && t?.data) {
            txs.push({
              chainId: t.chainId ?? request.fromChainId,
              to: t.to,
              data: t.data,
              value:
                typeof t.value === "bigint"
                  ? t.value.toString()
                  : t.value ?? "0",
            });
          }
        }
      }
      if (!txs.length && Array.isArray(prepared?.steps)) {
        for (const s of prepared.steps) {
          if (Array.isArray(s?.transactions)) {
            for (const t of s.transactions) {
              if (t?.to && t?.data) {
                txs.push({
                  chainId: t.chainId ?? request.fromChainId,
                  to: t.to,
                  data: t.data,
                  value:
                    typeof t.value === "bigint"
                      ? t.value.toString()
                      : t.value ?? "0",
                });
              }
            }
          }
        }
      }

      if (!txs.length) {
        throw new Error("No origin transactions found in prepared quote");
      }

      const execResults = await this.executionPort.executeOriginTxs(
        txs,
        {
          type: "ERC4337",
          smartAccountAddress: request.sender,
          signerAddress: request.signerAddress,
        },
        { sender: request.sender }
      );

      return {
        success: true,
        transactionHashes: execResults.map((r) => r.transactionHash),
        estimatedDuration: Math.floor((prepared?.estimatedExecutionTimeMs ?? 0) / 1000),
        message: "Swap executed via Engine (ERC4337)",
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
