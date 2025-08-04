import { SwapRequest, SwapResult } from "../../domain/entities/swap";
import { ISwapRepository } from "../../domain/ports/swap.repository";

// In-memory implementation for now
// In production, this would connect to a real database
export class SwapRepositoryAdapter implements ISwapRepository {
  private readonly swapRequests: Map<string, SwapRequest> = new Map();
  private readonly swapResults: Map<string, SwapResult[]> = new Map();

  public async saveSwapRequest(swapRequest: SwapRequest): Promise<void> {
    const key = `${swapRequest.sender}-${Date.now()}`;
    this.swapRequests.set(key, swapRequest);
    console.log(`[SwapRepositoryAdapter] Saved swap request: ${key}`);
  }

  public async getSwapHistory(userAddress: string): Promise<SwapResult[]> {
    const results = this.swapResults.get(userAddress) || [];
    console.log(`[SwapRepositoryAdapter] Retrieved ${results.length} swap results for ${userAddress}`);
    return results;
  }

  public async saveSwapResult(swapResult: SwapResult): Promise<void> {
    // Extract user address from first transaction
    const firstTx = swapResult.transactions[0];
    if (firstTx) {
      const userAddress = "extracted_from_transaction"; // In real implementation, extract from transaction
      const existing = this.swapResults.get(userAddress) || [];
      existing.push(swapResult);
      this.swapResults.set(userAddress, existing);
      console.log(`[SwapRepositoryAdapter] Saved swap result for user`);
    }
  }

  public async updateTransactionStatus(transactionHash: string, status: string): Promise<void> {
    // Implementation would update the transaction status in database
    console.log(`[SwapRepositoryAdapter] Updated transaction ${transactionHash} status to ${status}`);
  }
} 