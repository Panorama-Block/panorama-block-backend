import { DIContainer } from '../../di/container';
import { ContextLogger, createRequestLogger } from '../../utils/logger';

export class TacOperationSocketHandler {
  private log: ContextLogger;

  constructor(private container: DIContainer, private socket: any) {
    this.log = createRequestLogger(socket.id, socket.userId);
  }

  async subscribeToOperation({ operationId }: { operationId: string }) {
    this.log.info('operation:subscribe', { operationId });
    await this.socket.join(`operation:${operationId}`);
  }

  async unsubscribeFromOperation({ operationId }: { operationId: string }) {
    this.log.info('operation:unsubscribe', { operationId });
    await this.socket.leave(`operation:${operationId}`);
  }

  async getOperationStatus({ operationId }: { operationId: string }, callback?: Function) {
    try {
      const status = await this.container.tacOperationService.getOperationStatus(operationId);
      callback?.({ success: true, data: status });
    } catch (e: any) {
      callback?.({ success: false, error: e.message });
    }
  }

  async cancelOperation({ operationId }: { operationId: string }, callback?: Function) {
    try {
      await this.container.tacOperationService.cancelOperation(operationId, this.socket.userId);
      callback?.({ success: true });
    } catch (e: any) {
      callback?.({ success: false, error: e.message });
    }
  }
}
