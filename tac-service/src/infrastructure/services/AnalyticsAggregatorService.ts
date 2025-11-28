import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';

interface AnalyticsAggregatorOptions {
  aggregationInterval: number;
  retentionPeriod: number;
}

export class AnalyticsAggregatorService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: ITacRepository,
    private readonly analytics: ITacAnalyticsService,
    private readonly options: AnalyticsAggregatorOptions
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.archive().catch(err => console.error('[AnalyticsAggregator] archive failed', err));
    }, this.options.aggregationInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async archive(): Promise<void> {
    await this.repository.pruneHistoricalData({
      expiredQuoteRetentionMs: 24 * 60 * 60 * 1000,
      analyticsRetentionMs: this.options.retentionPeriod,
      eventRetentionMs: 30 * 24 * 60 * 60 * 1000,
      notificationRetentionMs: 7 * 24 * 60 * 60 * 1000
    });
  }

  async getDashboardMetrics(timeframe: '24h' | '7d' | '30d' | '90d') {
    return this.analytics.getDashboardMetrics(timeframe);
  }
}
