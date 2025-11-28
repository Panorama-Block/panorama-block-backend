import { TacOperationService, CreateOperationRequest } from '../services/TacOperationService';
import { TacQuoteService } from '../services/TacQuoteService';
import { TacConfigurationService } from '../services/TacConfigurationService';
import { TacEventService } from '../services/TacEventService';

export class InitiateCrossChainOperationUseCase {
  constructor(
    private readonly operationService: TacOperationService,
    private readonly quoteService: TacQuoteService,
    private readonly configService: TacConfigurationService,
    private readonly eventService: TacEventService
  ) {}

  async execute(request: CreateOperationRequest) {
    const config = await this.configService.getUserConfiguration(request.userId);
    const operation = await this.operationService.createOperation({
      ...request,
      slippage: request.slippage ?? config?.defaultSlippage
    });

    await this.eventService.recordEvent({
      eventType: 'operation_created',
      eventData: { operationId: operation.id },
      operationId: operation.id,
      userId: operation.userId
    });

    return operation;
  }
}
