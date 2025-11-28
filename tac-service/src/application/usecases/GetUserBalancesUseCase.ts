import { TacBalanceService } from '../services/TacBalanceService';
import { TacConfigurationService } from '../services/TacConfigurationService';

export class GetUserBalancesUseCase {
  constructor(
    private readonly balanceService: TacBalanceService,
    private readonly configurationService: TacConfigurationService
  ) {}

  async execute(userId: string) {
    const [balances, summary] = await Promise.all([
      this.balanceService.getUserBalances(userId),
      this.balanceService.getUserPortfolioSummary(userId)
    ]);
    const config = await this.configurationService.getUserConfiguration(userId);
    return { balances, summary, preferences: config };
  }
}
