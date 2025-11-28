import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { INotificationService } from '../../domain/interfaces/INotificationService';

export class TacConfigurationService {
  constructor(
    private readonly repository: ITacRepository,
    private readonly notifications: INotificationService
  ) {}

  async getUserConfiguration(userId: string) {
    return this.repository.getUserConfiguration(userId);
  }

  async updateUserConfiguration(userId: string, config: any) {
    const updated = await this.repository.updateUserConfiguration(userId, config);
    await this.notifications.sendNotification({
      userId,
      type: 'system_alert',
      title: 'Preferences updated',
      body: 'Your TAC configuration was updated.',
      channels: ['websocket']
    });
    return updated;
  }
}
