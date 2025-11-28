import { TacBalanceService } from '../services/TacBalanceService';
import { TacOperationService } from '../services/TacOperationService';
import { TacEventService } from '../services/TacEventService';

export class ClaimRewardsUseCase {
  constructor(
    private readonly balanceService: TacBalanceService,
    private readonly operationService: TacOperationService,
    private readonly eventService: TacEventService
  ) {}

  async execute(userId: string, request: { balanceId?: string; tokenSymbol?: string; amount?: string }) {
    const balance = await this.balanceService.claimRewards(userId, request);
    await this.eventService.recordEvent({
      eventType: 'rewards_claimed',
      eventData: { balanceId: balance.id, amount: request.amount ?? balance.getClaimableRewards() },
      userId
    });
    return balance;
  }
}
