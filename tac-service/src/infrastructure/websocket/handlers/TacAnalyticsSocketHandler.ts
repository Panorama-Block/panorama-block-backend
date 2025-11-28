import { DIContainer } from '../../di/container';
import { ContextLogger, createRequestLogger } from '../../utils/logger';

export class TacAnalyticsSocketHandler {
  private log: ContextLogger;

  constructor(private container: DIContainer, private socket: any) {
    this.log = createRequestLogger(socket.id, socket.userId);
  }

  async subscribeToAnalytics() {
    if (this.socket.userRole !== 'admin') return;
    await this.socket.join('analytics');
    this.log.info('analytics:subscribe', { userId: this.socket.userId });
  }

  async unsubscribeFromAnalytics() {
    await this.socket.leave('analytics');
    this.log.info('analytics:unsubscribe', { userId: this.socket.userId });
  }

  async getMetrics(callback?: Function) {
    if (this.socket.userRole !== 'admin') {
      callback?.({ success: false, error: 'forbidden' });
      return;
    }
    try {
      const metrics = await this.container.analyticsService?.getDashboardMetrics('24h');
      callback?.({ success: true, data: metrics });
    } catch (e: any) {
      callback?.({ success: false, error: e.message });
    }
  }
}
