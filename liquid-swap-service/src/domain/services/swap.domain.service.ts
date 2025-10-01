// Domain Service
import { SwapRequest, SwapQuote, SwapResult } from "../entities/swap";
import {
  ISwapService,
  IChainProvider,
  ISwapRepository,
} from "../ports/swap.repository";

export class SwapDomainService {
  constructor(
    private readonly swapService: ISwapService,
    private readonly chainProvider: IChainProvider,
    private readonly swapRepository: ISwapRepository
  ) {}

  public async validateSwapRequest(swapRequest: SwapRequest): Promise<void> {
    if (!this.chainProvider.isChainSupported(swapRequest.fromChainId)) {
      throw new Error(`Chain ${swapRequest.fromChainId} is not supported`);
    }
    if (!this.chainProvider.isChainSupported(swapRequest.toChainId)) {
      throw new Error(`Chain ${swapRequest.toChainId} is not supported`);
    }
    if (swapRequest.fromChainId === swapRequest.toChainId) {
      throw new Error("Cannot swap on the same chain");
    }
    console.log(
      `[SwapDomainService] Swap request validated: ${swapRequest.toLogString()}`
    );
  }

  public async getQuote(swapRequest: SwapRequest): Promise<SwapQuote> {
    console.log(
      `[SwapDomainService] Getting quote for: ${swapRequest.toLogString()}`
    );
    await this.validateSwapRequest(swapRequest);
    const quote = await this.swapService.getQuote(swapRequest);
    console.log(
      `[SwapDomainService] Quote received: ${quote.estimatedReceiveAmount.toString()}`
    );
    return quote;
  }

  /**
   * V1 non-custodial: apenas PREPARA o bundle de transações.
   */
  public async prepareSwap(swapRequest: SwapRequest): Promise<any> {
    console.log(
      `[SwapDomainService] Preparing swap: ${swapRequest.toLogString()}`
    );
    await this.validateSwapRequest(swapRequest);
    const prepared = await this.swapService.prepareSwap(swapRequest);
    return prepared;
  }

  /**
   * Mantido por compatibilidade; não usar no V1 non-custodial.
   */
  public async processSwap(swapRequest: SwapRequest): Promise<SwapResult> {
    console.log(
      `[SwapDomainService] Processing swap (server-side DISABLED in V1): ${swapRequest.toLogString()}`
    );
    // Se for chamado, o adapter lançará erro.
    await this.validateSwapRequest(swapRequest);
    return await this.swapService.executeSwap(swapRequest);
  }

  public async getSwapHistory(userAddress: string): Promise<SwapResult[]> {
    return await this.swapRepository.getSwapHistory(userAddress);
  }

  public async monitorStatus(transactionHash: string, chainId: number): Promise<string> {
    return await this.swapService.monitorTransaction(transactionHash, chainId);
  }
}
