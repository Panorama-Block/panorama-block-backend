import { DIContainer } from '../../di/container';
import { ContextLogger, createRequestLogger } from '../../utils/logger';

export class TacBalanceSocketHandler {
  private log: ContextLogger;

  constructor(private container: DIContainer, private socket: any) {
    this.log = createRequestLogger(socket.id, socket.userId);
  }

  async subscribeToBalanceUpdates() {
    await this.socket.join(`balance:${this.socket.userId}`);
    this.log.info('balance:subscribe', { userId: this.socket.userId });
  }

  async unsubscribeFromBalanceUpdates() {
    await this.socket.leave(`balance:${this.socket.userId}`);
    this.log.info('balance:unsubscribe', { userId: this.socket.userId });
  }

  async refreshBalances(callback?: Function) {
    try {
      const balances = await this.container.tacBalanceService.getUserBalances(this.socket.userId);
      callback?.({ success: true, data: balances });
    } catch (e: any) {
      callback?.({ success: false, error: e.message });
    }
  }
}
