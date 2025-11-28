import {
  INotificationService,
  NotificationMessage,
  WebSocketUpdate,
  NotificationPreferences,
  NotificationTemplate
} from '../../domain/interfaces/INotificationService';

type UpdateCallback = (update: WebSocketUpdate) => void;

interface NotificationOptions {
  enablePush: boolean;
}

export class WebSocketNotificationService implements INotificationService {
  private userSubscriptions = new Map<string, Set<UpdateCallback>>();
  private templates = new Map<string, NotificationTemplate>();
  private preferences = new Map<string, NotificationPreferences>();

  constructor(private readonly options: NotificationOptions) {}

  async sendNotification(_notification: NotificationMessage): Promise<void> {
    // In a full implementation we would persist and fan-out notifications.
  }

  async sendToUser(_userId: string, _message: NotificationMessage): Promise<void> {
    // Placeholder: rely on websocket broadcast for now.
  }

  async sendBulk(_notifications: NotificationMessage[]): Promise<void> {
    // No-op bulk implementation for now.
  }

  async sendOperationNotification(
    userId: string,
    type: string,
    operation: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type,
      title: 'Operation update',
      body: `Operation ${operation.id} status: ${type}`,
      data: { operationId: operation.id, metadata },
      channels: ['websocket']
    });
    await this.broadcastToUser(userId, {
      operationId: operation.id,
      type: 'operation_progress',
      progress: operation.getProgressPercentage?.() || 0,
      message: type,
      timestamp: new Date()
    } as WebSocketUpdate);
  }

  async subscribeToUserUpdates(userId: string, callback: UpdateCallback): Promise<void> {
    const existing = this.userSubscriptions.get(userId) || new Set();
    existing.add(callback);
    this.userSubscriptions.set(userId, existing);
  }

  async unsubscribeFromUserUpdates(userId: string): Promise<void> {
    this.userSubscriptions.delete(userId);
  }

  async broadcastToUser(userId: string, update: WebSocketUpdate): Promise<void> {
    const callbacks = this.userSubscriptions.get(userId);
    if (!callbacks) return;
    callbacks.forEach(cb => cb(update));
  }

  async broadcastToAll(update: Omit<WebSocketUpdate, 'operationId'>): Promise<void> {
    this.userSubscriptions.forEach(callbacks => {
      callbacks.forEach(cb => cb({ ...update, operationId: 'broadcast' } as WebSocketUpdate));
    });
  }

  async sendPushNotification(_userId: string, _config: any): Promise<void> {
    if (!this.options.enablePush) return;
  }

  async registerPushSubscription(_userId: string, _subscription: any): Promise<void> {
    // Persist in datastore in future.
  }

  async unregisterPushSubscription(_userId: string): Promise<void> {
    // Placeholder
  }

  async sendTelegramNotification(_config: any): Promise<void> {
    // Placeholder for Telegram integration
  }

  async registerTelegramUser(_userId: string, _chatId: string): Promise<void> {
    // Placeholder
  }

  async unregisterTelegramUser(_userId: string): Promise<void> {
    // Placeholder
  }

  async sendEmail(_to: string, _subject: string, _html: string, _text?: string): Promise<void> {
    // Placeholder for SMTP provider
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, {
        channels: {
          websocket: true,
          push: this.options.enablePush,
          telegram: false,
          email: false,
          sms: false
        },
        types: {
          operation_started: true,
          operation_progress: true,
          operation_completed: true,
          operation_failed: true,
          balance_updated: true,
          rewards_available: true,
          system_alert: true,
          security_alert: true
        },
        frequency: { immediate: true, batched: false, batch_interval: 15 }
      });
    }
    return this.preferences.get(userId)!;
  }

  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const current = await this.getUserPreferences(userId);
    this.preferences.set(userId, { ...current, ...preferences });
  }

  async getNotificationHistory(_userId: string, _limit?: number, _offset?: number): Promise<NotificationMessage[]> {
    return [];
  }

  async markAsRead(_userId: string, _notificationId: string): Promise<void> {
    // Placeholder
  }

  async markAllAsRead(_userId: string): Promise<void> {
    // Placeholder
  }

  async registerTemplate(templateId: string, template: NotificationTemplate): Promise<void> {
    this.templates.set(templateId, template);
  }

  async sendFromTemplate(templateId: string, userId: string, variables: Record<string, any>): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;
    const body = template.body.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? '');
    await this.sendToUser(userId, {
      userId,
      type: template.type,
      title: template.title,
      body,
      channels: template.channels
    });
  }
}
