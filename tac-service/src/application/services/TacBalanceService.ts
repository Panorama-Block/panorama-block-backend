import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { IBalanceSyncService, BalanceSyncOptions } from '../../domain/interfaces/IBalanceSyncService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';
import { TacBalance } from '../../domain/entities/TacBalance';

export class TacBalanceService {
  constructor(
    private readonly repository: ITacRepository,
    private readonly balanceSync: IBalanceSyncService,
    private readonly analytics: ITacAnalyticsService
  ) {}

  async getUserBalances(userId: string): Promise<TacBalance[]> {
    return this.repository.findUserBalances(userId);
  }

  async getUserPortfolioSummary(userId: string) {
    return this.repository.getUserPortfolioValue(userId);
  }

  async syncUserBalances(userId: string, options: BalanceSyncOptions = {}) {
    return this.balanceSync.syncUserBalances(userId, options);
  }

  async claimRewards(userId: string, params: { balanceId?: string; tokenSymbol?: string; amount?: string }) {
    const balances = await this.repository.findUserBalances(userId);
    const target = balances.find(balance =>
      params.balanceId ? balance.id === params.balanceId : balance.tokenSymbol === params.tokenSymbol
    );

    if (!target) {
      throw new Error('Balance not found for claim');
    }

    const claimAmount = params.amount || target.getClaimableRewards();
    target.claimRewards(claimAmount);
    await this.repository.updateBalance(target);
    return target;
  }
}
