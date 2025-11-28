import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacSdkBridgeService } from '../../domain/interfaces/ITacBridgeService';
import { INotificationService } from '../../domain/interfaces/INotificationService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';

interface OperationMonitorOptions {
  checkInterval: number;
  batchSize: number;
}

export class OperationMonitorService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: ITacRepository,
    private readonly tacSdk: ITacSdkBridgeService,
    private readonly notifications: INotificationService,
    private readonly analytics: ITacAnalyticsService,
    private readonly options: OperationMonitorOptions
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.pollPendingOperations().catch(err => {
        console.error('[OperationMonitor] poll failed', err);
      });
    }, this.options.checkInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async pollPendingOperations(): Promise<void> {
    const operations = await this.repository.findPendingOperations(this.options.batchSize);
    for (const operation of operations) {
      if (!operation.tacTransactionId) continue;
      try {
        const status = await this.tacSdk.getTacTransactionStatus(operation.tacTransactionId);
        if (status.isCompleted) {
          operation.complete();
          await this.repository.updateOperation(operation);
          await this.analytics.trackOperationCompleted(operation);
          await this.notifications.sendOperationNotification?.(
            operation.userId,
            'operation_completed',
            operation
          );
        } else if (status.isFailed) {
          operation.fail(status.failureReason || 'Bridge failed');
          await this.repository.updateOperation(operation);
          await this.analytics.trackOperationFailed(operation, status.failureReason || 'unknown');
        }
      } catch (error) {
        console.error('[OperationMonitor] failed to refresh operation', operation.id, error);
      }
    }
  }
}
