import { TacQuoteService, QuoteRequest } from '../services/TacQuoteService';
import { TacConfigurationService } from '../services/TacConfigurationService';

export class GetCrossChainQuoteUseCase {
  constructor(
    private readonly quoteService: TacQuoteService,
    private readonly configService: TacConfigurationService
  ) {}

  async execute(userId: string, request: Omit<QuoteRequest, 'userId'>) {
    const config = await this.configService.getUserConfiguration(userId);
    return this.quoteService.generateQuote({
      userId,
      ...request,
      slippage: request.slippage ?? config?.defaultSlippage
    });
  }
}
