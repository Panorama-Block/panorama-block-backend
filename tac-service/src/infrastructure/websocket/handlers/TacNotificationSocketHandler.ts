import { DIContainer } from '../../di/container';
import { ContextLogger, createRequestLogger } from '../../utils/logger';

export class TacNotificationSocketHandler {
  private log: ContextLogger;

  constructor(private container: DIContainer, private socket: any) {
    this.log = createRequestLogger(socket.id, socket.userId);
  }

  async subscribeToNotifications() {
    await this.socket.join(`notification:${this.socket.userId}`);
    this.log.info('notification:subscribe', { userId: this.socket.userId });
  }

  async unsubscribeFromNotifications() {
    await this.socket.leave(`notification:${this.socket.userId}`);
    this.log.info('notification:unsubscribe', { userId: this.socket.userId });
  }

  async markNotificationAsRead({ notificationId }: { notificationId: string }, callback?: Function) {
    try {
      await this.container.notificationService.markAsRead?.(this.socket.userId, notificationId);
      callback?.({ success: true });
    } catch (e: any) {
      callback?.({ success: false, error: e.message });
    }
  }
}
