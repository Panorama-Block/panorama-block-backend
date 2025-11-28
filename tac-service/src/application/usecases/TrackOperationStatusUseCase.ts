import { TacOperationService } from '../services/TacOperationService';
import { TacEventService } from '../services/TacEventService';

export class TrackOperationStatusUseCase {
  constructor(
    private readonly operationService: TacOperationService,
    private readonly eventService: TacEventService
  ) {}

  async execute(operationId: string) {
    const status = await this.operationService.getOperationStatus(operationId);
    await this.eventService.recordEvent({
      eventType: 'operation_status_requested',
      eventData: status,
      operationId
    });
    return status;
  }
}
