// Domain Service
import { SwapRequest, SwapQuote, SwapResult, SwapTransaction, TransactionStatus } from "../entities/swap";
import { ISwapService, IChainProvider, ISwapRepository } from "../ports/swap.repository";

export class SwapDomainService {
  constructor(
    private readonly swapService: ISwapService,
    private readonly chainProvider: IChainProvider,
    private readonly swapRepository: ISwapRepository
  ) {}

  public async validateSwapRequest(swapRequest: SwapRequest): Promise<void> {
    // Validate chain support
    if (!this.chainProvider.isChainSupported(swapRequest.fromChainId)) {
      throw new Error(`Chain ${swapRequest.fromChainId} is not supported`);
    }
    
    if (!this.chainProvider.isChainSupported(swapRequest.toChainId)) {
      throw new Error(`Chain ${swapRequest.toChainId} is not supported`);
    }

    // Validate same chain
    if (swapRequest.fromChainId === swapRequest.toChainId) {
      throw new Error("Cannot swap on the same chain");
    }

    // Additional business rules can be added here
    console.log(`[SwapDomainService] Swap request validated: ${swapRequest.toLogString()}`);
  }

  public async getQuote(swapRequest: SwapRequest): Promise<SwapQuote> {
    console.log(`[SwapDomainService] Getting quote for: ${swapRequest.toLogString()}`);

    // Validate request first
    await this.validateSwapRequest(swapRequest);

    // Get quote without executing
    const quote = await this.swapService.getQuote(swapRequest);
    console.log(`[SwapDomainService] Quote received: ${quote.estimatedReceiveAmount.toString()}`);

    return quote;
  }

  public async processSwap(swapRequest: SwapRequest): Promise<SwapResult> {
    console.log(`[SwapDomainService] Processing swap: ${swapRequest.toLogString()}`);

    // Validate request
    await this.validateSwapRequest(swapRequest);

    // Save request for audit
    await this.swapRepository.saveSwapRequest(swapRequest);

    // Get quote
    const quote = await this.swapService.getQuote(swapRequest);
    console.log(`[SwapDomainService] Quote received: ${quote.estimatedReceiveAmount.toString()}`);

    // Execute swap
    const result = await this.swapService.executeSwap(swapRequest);
    
    // Save result
    await this.swapRepository.saveSwapResult(result);

    console.log(`[SwapDomainService] Swap completed successfully`);
    return result;
  }

  public async getSwapHistory(userAddress: string): Promise<SwapResult[]> {
    return await this.swapRepository.getSwapHistory(userAddress);
  }
} 