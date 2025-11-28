import { TacConfigurationService } from '../services/TacConfigurationService';
import { TacEventService } from '../services/TacEventService';

export class UpdateUserConfigurationUseCase {
  constructor(
    private readonly configService: TacConfigurationService,
    private readonly eventService: TacEventService
  ) {}

  async execute(userId: string, config: any) {
    const updated = await this.configService.updateUserConfiguration(userId, config);
    await this.eventService.recordEvent({
      eventType: 'configuration_updated',
      eventData: { userId },
      userId
    });
    return updated;
  }
}
