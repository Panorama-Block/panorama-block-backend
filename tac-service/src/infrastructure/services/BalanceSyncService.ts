import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { IBalanceSyncService, BalanceSyncOptions, BalanceSyncResult } from '../../domain/interfaces/IBalanceSyncService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';

export class BalanceSyncService implements IBalanceSyncService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: ITacRepository,
    private readonly tacSdk: any,
    private readonly analytics: ITacAnalyticsService
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.syncAllBalances({}).catch(err => {
        console.error('[BalanceSync] background sync failed', err);
      });
    }, 5 * 60 * 1000);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async syncUserBalances(userId: string, options: BalanceSyncOptions = {}): Promise<BalanceSyncResult> {
    const balances = await this.repository.findUserBalances(userId);
    let synced = 0;

    for (const balance of balances) {
      try {
        if (!options.force && !balance.needsSync()) continue;
        const updated = balance;
        updated.markAsSynced();
        await this.repository.updateBalance(updated);
        synced += 1;
      } catch {
        // Ignore single balance failure
      }
    }

    return { synced, failed: balances.length - synced };
  }

  async syncAllBalances(options: BalanceSyncOptions = {}): Promise<BalanceSyncResult> {
    const balances = await this.repository.findBalancesNeedingSync(10 * 60 * 1000);
    let synced = 0;

    for (const balance of balances) {
      try {
        const updated = balance;
        updated.markAsSynced();
        await this.repository.updateBalance(updated);
        synced += 1;
      } catch {
        // continue
      }
    }

    return { synced, failed: balances.length - synced };
  }
}
