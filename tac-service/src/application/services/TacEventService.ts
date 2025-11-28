import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { INotificationService } from '../../domain/interfaces/INotificationService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';

export class TacEventService {
  constructor(
    private readonly repository: ITacRepository,
    private readonly notifications: INotificationService,
    private readonly analytics: ITacAnalyticsService
  ) {}

  async recordEvent(event: { eventType: string; eventData: Record<string, any>; userId?: string; operationId?: string }) {
    await this.repository.saveEvent({
      eventType: event.eventType,
      eventData: event.eventData,
      userId: event.userId,
      operationId: event.operationId,
      source: 'tac-service'
    });
  }

  async handleWebhookEvent(payload: any) {
    await this.recordEvent({
      eventType: payload.type || 'webhook_event',
      eventData: payload,
      operationId: payload.operationId
    });
  }
}
