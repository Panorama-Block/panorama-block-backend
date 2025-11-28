import { ITacRepository } from '../../domain/interfaces/ITacRepository';

interface CleanupOptions {
  cleanupInterval: number;
  expiredQuoteRetention: number;
  oldAnalyticsRetention: number;
  processedEventRetention: number;
  notificationRetention: number;
}

export class DataCleanupScheduler {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: ITacRepository,
    private readonly options: CleanupOptions
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.repository.pruneHistoricalData({
        expiredQuoteRetentionMs: this.options.expiredQuoteRetention,
        analyticsRetentionMs: this.options.oldAnalyticsRetention,
        eventRetentionMs: this.options.processedEventRetention,
        notificationRetentionMs: this.options.notificationRetention
      }).catch(err => console.error('[DataCleanup] failed', err));
    }, this.options.cleanupInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
