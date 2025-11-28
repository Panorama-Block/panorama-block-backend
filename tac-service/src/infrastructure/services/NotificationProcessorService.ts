import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { INotificationService } from '../../domain/interfaces/INotificationService';

interface NotificationProcessorOptions {
  batchSize: number;
  processingInterval: number;
}

export class NotificationProcessorService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: ITacRepository,
    private readonly notifications: INotificationService,
    private readonly options: NotificationProcessorOptions
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.process().catch(err => console.error('[NotificationProcessor] failed', err));
    }, this.options.processingInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async process(): Promise<void> {
    const pending = await this.repository.getPendingNotifications(this.options.batchSize);
    for (const notification of pending) {
      await this.notifications.sendNotification(notification);
      await this.repository.markNotificationSent(notification.id, { channels: notification.channels });
    }
  }
}
