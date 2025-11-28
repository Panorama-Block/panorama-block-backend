import { PrismaClient, Prisma } from '@prisma/client';
import { ITacRepository, OperationSearchFilters, BalancePortfolioBreakdown, TotalValueLockedBreakdown } from '../../domain/interfaces/ITacRepository';
import { TacOperation, TacOperationStep } from '../../domain/entities/TacOperation';
import { CrossChainQuote } from '../../domain/entities/CrossChainQuote';
import { TacBalance } from '../../domain/entities/TacBalance';

type PrismaOperation = Prisma.TacOperationGetPayload<{}>;
type PrismaQuote = Prisma.CrossChainQuoteGetPayload<{}>;
type PrismaBalance = Prisma.TacBalanceGetPayload<{}>;
type PrismaConfiguration = Prisma.TacConfigurationGetPayload<{}>;

export class PrismaTacRepository implements ITacRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // -------- Operations --------
  async saveOperation(operation: TacOperation): Promise<TacOperation> {
    const data = this.operationToPersistence(operation);
    const created = await this.prisma.tacOperation.create({ data });
    return this.operationFromPersistence(created);
  }

  async updateOperation(operation: TacOperation): Promise<TacOperation> {
    const data = this.operationToPersistence(operation);
    const updated = await this.prisma.tacOperation.update({
      where: { id: operation.id },
      data
    });
    return this.operationFromPersistence(updated);
  }

  async deleteOperation(id: string): Promise<void> {
    await this.prisma.tacOperation.delete({ where: { id } }).catch(() => undefined);
  }

  async findOperationById(id: string): Promise<TacOperation | null> {
    const record = await this.prisma.tacOperation.findUnique({ where: { id } });
    return record ? this.operationFromPersistence(record) : null;
  }

  async findOperations(filters: OperationSearchFilters, limit = 50, offset = 0): Promise<TacOperation[]> {
    const where: Prisma.TacOperationWhereInput = {
      userId: filters.userId,
      status: filters.status,
      operationType: filters.operationType,
      sourceChain: filters.sourceChain,
      targetChain: filters.targetChain,
      protocol: filters.protocol,
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate
      }
    };

    const records = await this.prisma.tacOperation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    return records.map(r => this.operationFromPersistence(r));
  }

  async findPendingOperations(limit = 50): Promise<TacOperation[]> {
    const records = await this.prisma.tacOperation.findMany({
      where: {
        status: { in: ['initiated', 'bridging_to_evm', 'in_progress', 'executing_protocol'] }
      },
      orderBy: { updatedAt: 'asc' },
      take: limit
    });
    return records.map(r => this.operationFromPersistence(r));
  }

  async findRecentOperations(timeframeHours: number): Promise<TacOperation[]> {
    const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const records = await this.prisma.tacOperation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }
    });
    return records.map(r => this.operationFromPersistence(r));
  }

  async findOperationsByStatus(status: string, limit = 100): Promise<TacOperation[]> {
    const records = await this.prisma.tacOperation.findMany({
      where: { status },
      orderBy: { updatedAt: 'asc' },
      take: limit
    });
    return records.map(r => this.operationFromPersistence(r));
  }

  async getOperationMetrics(timeframe: '24h' | '7d' | '30d') {
    const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 24 * 7 : 24 * 30;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [totalCount, successCount, failedCount, durationAgg] = await Promise.all([
      this.prisma.tacOperation.count({ where: { createdAt: { gte: since } } }),
      this.prisma.tacOperation.count({ where: { createdAt: { gte: since }, status: 'completed' } }),
      this.prisma.tacOperation.count({ where: { createdAt: { gte: since }, status: 'failed' } }),
      this.prisma.tacOperation.aggregate({
        where: { createdAt: { gte: since }, actualTime: { not: null } },
        _avg: { actualTime: true }
      })
    ]);

    return {
      totalOperations: totalCount,
      successfulOperations: successCount,
      failedOperations: failedCount,
      averageCompletionTime: durationAgg._avg.actualTime || 0,
      totalVolume: '0'
    };
  }

  async getUserOperationStats(userId: string) {
    const [totalOperations, completed, totalVolume] = await Promise.all([
      this.prisma.tacOperation.count({ where: { userId } }),
      this.prisma.tacOperation.count({ where: { userId, status: 'completed' } }),
      this.prisma.tacOperation.aggregate({
        where: { userId, status: 'completed', outputAmount: { not: null } },
        _avg: { outputAmount: true }
      })
    ]);

    const favoriteProtocols = await this.prisma.tacOperation.groupBy({
      by: ['protocol'],
      where: { userId, protocol: { not: null } },
      _count: { protocol: true },
      orderBy: { _count: { protocol: 'desc' } },
      take: 3
    });

    return {
      totalOperations,
      successRate: totalOperations === 0 ? 0 : Math.round((completed / totalOperations) * 100),
      totalVolume: '0',
      favoriteProtocols: favoriteProtocols.map(p => p.protocol || 'unknown'),
      averageOperationSize: totalVolume._avg.outputAmount?.toString() || '0'
    };
  }

  // -------- Quotes --------
  async saveQuote(quote: CrossChainQuote): Promise<CrossChainQuote> {
    const data = this.quoteToPersistence(quote);
    const created = await this.prisma.crossChainQuote.create({ data });
    return this.quoteFromPersistence(created);
  }

  async updateQuote(quote: CrossChainQuote): Promise<CrossChainQuote> {
    const data = this.quoteToPersistence(quote);
    const updated = await this.prisma.crossChainQuote.update({
      where: { id: quote.id },
      data
    });
    return this.quoteFromPersistence(updated);
  }

  async deleteQuote(id: string): Promise<void> {
    await this.prisma.crossChainQuote.delete({ where: { id } }).catch(() => undefined);
  }

  async findQuoteById(id: string): Promise<CrossChainQuote | null> {
    const record = await this.prisma.crossChainQuote.findUnique({ where: { id } });
    return record ? this.quoteFromPersistence(record) : null;
  }

  async findUserQuotes(userId: string, includeExpired = false, limit = 20): Promise<CrossChainQuote[]> {
    const records = await this.prisma.crossChainQuote.findMany({
      where: {
        userId,
        ...(includeExpired ? {} : { expiresAt: { gt: new Date() } })
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return records.map(r => this.quoteFromPersistence(r));
  }

  async findActiveQuotes(limit = 50): Promise<CrossChainQuote[]> {
    const records = await this.prisma.crossChainQuote.findMany({
      where: { expiresAt: { gt: new Date() }, isExecuted: false },
      orderBy: { expiresAt: 'asc' },
      take: limit
    });
    return records.map(r => this.quoteFromPersistence(r));
  }

  async deleteExpiredQuotes(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const threshold = new Date(Date.now() - maxAgeMs);
    const result = await this.prisma.crossChainQuote.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        createdAt: { lt: threshold }
      }
    });
    return result.count;
  }

  // -------- Balances --------
  async saveBalance(balance: TacBalance): Promise<TacBalance> {
    const data = this.balanceToPersistence(balance);
    const created = await this.prisma.tacBalance.create({ data });
    return this.balanceFromPersistence(created);
  }

  async updateBalance(balance: TacBalance): Promise<TacBalance> {
    const data = this.balanceToPersistence(balance);
    const updated = await this.prisma.tacBalance.update({
      where: { id: balance.id },
      data
    });
    return this.balanceFromPersistence(updated);
  }

  async deleteBalance(id: string): Promise<void> {
    await this.prisma.tacBalance.delete({ where: { id } }).catch(() => undefined);
  }

  async findBalanceById(id: string): Promise<TacBalance | null> {
    const record = await this.prisma.tacBalance.findUnique({ where: { id } });
    return record ? this.balanceFromPersistence(record) : null;
  }

  async findUserBalances(userId: string): Promise<TacBalance[]> {
    const records = await this.prisma.tacBalance.findMany({ where: { userId } });
    return records.map(r => this.balanceFromPersistence(r));
  }

  async findActiveBalances(): Promise<TacBalance[]> {
    const records = await this.prisma.tacBalance.findMany({ where: { isActive: true } });
    return records.map(r => this.balanceFromPersistence(r));
  }

  async findBalancesNeedingSync(maxAgeMs: number): Promise<TacBalance[]> {
    const threshold = new Date(Date.now() - maxAgeMs);
    const records = await this.prisma.tacBalance.findMany({
      where: { lastSyncAt: { lt: threshold } },
      orderBy: { lastSyncAt: 'asc' }
    });
    return records.map(r => this.balanceFromPersistence(r));
  }

  async getUserPortfolioValue(userId: string): Promise<BalancePortfolioBreakdown> {
    const balances = await this.prisma.tacBalance.findMany({ where: { userId } });
    const totalValue = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    const byProtocol = balances.reduce<Record<string, { total: number; positions: number }>>((acc, bal) => {
      const key = bal.sourceProtocol;
      if (!acc[key]) acc[key] = { total: 0, positions: 0 };
      acc[key].total += Number(bal.balance);
      acc[key].positions += 1;
      return acc;
    }, {});

    return {
      totalValueUSD: totalValue.toString(),
      balancesByProtocol: Object.entries(byProtocol).map(([protocol, entry]) => ({
        protocol,
        totalValue: entry.total.toString(),
        positions: entry.positions
      })),
      totalRewardsEarned: balances.reduce((sum, b) => sum + Number(b.rewardsEarned), 0).toString(),
      totalClaimableRewards: balances.reduce((sum, b) => sum + Number(b.rewardsEarned) - Number(b.rewardsClaimed), 0).toString()
    };
  }

  async getTotalValueLocked(): Promise<TotalValueLockedBreakdown> {
    const balances = await this.prisma.tacBalance.findMany();
    const total = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    const byProtocol = balances.reduce<Record<string, number>>((acc, bal) => {
      acc[bal.sourceProtocol] = (acc[bal.sourceProtocol] || 0) + Number(bal.balance);
      return acc;
    }, {});

    const byChain = balances.reduce<Record<string, number>>((acc, bal) => {
      acc[bal.sourceChain] = (acc[bal.sourceChain] || 0) + Number(bal.balance);
      return acc;
    }, {});

    return {
      totalUSD: total.toString(),
      byProtocol: Object.entries(byProtocol).map(([protocol, value]) => ({ protocol, tvl: value.toString() })),
      byChain: Object.entries(byChain).map(([chain, value]) => ({ chain, tvl: value.toString() }))
    };
  }

  // -------- Configuration --------
  async getUserConfiguration(userId: string): Promise<any | null> {
    const record = await this.prisma.tacConfiguration.findUnique({ where: { userId } });
    return record ? this.configurationFromPersistence(record) : null;
  }

  async saveUserConfiguration(userId: string, config: any): Promise<any> {
    const created = await this.prisma.tacConfiguration.create({
      data: {
        userId,
        ...config
      }
    });
    return this.configurationFromPersistence(created);
  }

  async updateUserConfiguration(userId: string, config: any): Promise<any> {
    const updated = await this.prisma.tacConfiguration.upsert({
      where: { userId },
      create: { userId, ...config },
      update: config
    });
    return this.configurationFromPersistence(updated);
  }

  // -------- Notifications --------
  async saveNotification(notification: any): Promise<void> {
    await this.prisma.tacNotification.create({ data: notification });
  }

  async getPendingNotifications(limit = 100): Promise<any[]> {
    return this.prisma.tacNotification.findMany({
      where: { sent: false, scheduledFor: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  async markNotificationSent(notificationId: string, meta?: Record<string, any>): Promise<void> {
    await this.prisma.tacNotification.update({
      where: { id: notificationId },
      data: {
        sent: true,
        sentAt: new Date(),
        channels: meta?.channels || undefined
      }
    });
  }

  // -------- Events --------
  async saveEvent(event: any): Promise<void> {
    await this.prisma.tacEvent.create({ data: event });
  }

  async getUnprocessedEvents(limit = 100): Promise<any[]> {
    return this.prisma.tacEvent.findMany({
      where: { processed: false },
      orderBy: { occurredAt: 'asc' },
      take: limit
    });
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await this.prisma.tacEvent.update({
      where: { id: eventId },
      data: { processed: true, processedAt: new Date() }
    });
  }

  async pruneHistoricalData(options: {
    expiredQuoteRetentionMs: number;
    analyticsRetentionMs: number;
    eventRetentionMs: number;
    notificationRetentionMs: number;
  }): Promise<void> {
    const now = Date.now();
    await Promise.all([
      this.prisma.crossChainQuote.deleteMany({
        where: { expiresAt: { lt: new Date(now - options.expiredQuoteRetentionMs) } }
      }),
      this.prisma.tacAnalytics.deleteMany({
        where: { createdAt: { lt: new Date(now - options.analyticsRetentionMs) } }
      }),
      this.prisma.tacEvent.deleteMany({
        where: { occurredAt: { lt: new Date(now - options.eventRetentionMs) } }
      }),
      this.prisma.tacNotification.deleteMany({
        where: { createdAt: { lt: new Date(now - options.notificationRetentionMs) } }
      })
    ]);
  }

  // -------- Mapping helpers --------
  private operationToPersistence(operation: TacOperation): Prisma.TacOperationCreateInput {
    return {
      id: operation.id,
      userId: operation.userId,
      conversationId: operation.conversationId,
      operationType: operation.operationType,
      status: operation.status,
      sourceChain: operation.sourceChain,
      targetChain: operation.targetChain,
      inputToken: operation.inputToken,
      inputAmount: new Prisma.Decimal(operation.inputAmount),
      outputToken: operation.outputToken,
      outputAmount: operation.outputAmount ? new Prisma.Decimal(operation.outputAmount) : undefined,
      protocol: operation.protocol,
      protocolAction: operation.protocolAction,
      tacTransactionId: operation.tacTransactionId,
      tacOperationHash: operation.tacOperationHash,
      estimatedTime: operation.estimatedTime,
      actualTime: operation.actualTime,
      totalFees: operation.totalFees ? new Prisma.Decimal(operation.totalFees) : undefined,
      steps: operation.getSteps(),
      currentStep: operation.currentStep,
      errorMessage: operation.errorMessage,
      errorCode: operation.errorCode,
      retryCount: operation.retryCount,
      lastRetryAt: operation.lastRetryAt,
      canRetry: operation.canRetry,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
      startedAt: operation.startedAt,
      completedAt: operation.completedAt
    };
  }

  private operationFromPersistence(record: PrismaOperation): TacOperation {
    return new TacOperation({
      id: record.id,
      userId: record.userId,
      conversationId: record.conversationId || undefined,
      operationType: record.operationType as any,
      status: record.status as any,
      sourceChain: record.sourceChain,
      targetChain: record.targetChain,
      inputToken: record.inputToken,
      inputAmount: record.inputAmount.toString(),
      outputToken: record.outputToken || undefined,
      outputAmount: record.outputAmount?.toString(),
      protocol: record.protocol || undefined,
      protocolAction: record.protocolAction || undefined,
      tacTransactionId: record.tacTransactionId || undefined,
      tacOperationHash: record.tacOperationHash || undefined,
      estimatedTime: record.estimatedTime || undefined,
      actualTime: record.actualTime || undefined,
      totalFees: record.totalFees?.toString(),
      steps: (record.steps as TacOperationStep[]) || [],
      currentStep: record.currentStep || 0,
      errorMessage: record.errorMessage || undefined,
      errorCode: record.errorCode || undefined,
      retryCount: record.retryCount || 0,
      lastRetryAt: record.lastRetryAt || undefined,
      canRetry: record.canRetry,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      startedAt: record.startedAt || undefined,
      completedAt: record.completedAt || undefined
    });
  }

  private quoteToPersistence(quote: CrossChainQuote): Prisma.CrossChainQuoteCreateInput {
    return {
      id: quote.id,
      userId: quote.userId,
      fromChain: quote.fromChain,
      toChain: quote.toChain,
      fromToken: quote.fromToken,
      toToken: quote.toToken,
      amount: new Prisma.Decimal(quote.amount),
      operationType: quote.operationType,
      route: quote.route as any,
      alternatives: quote.alternatives as any,
      metadata: quote.metadata as any,
      expiresAt: quote.expiresAt,
      createdAt: quote.createdAt
    };
  }

  private quoteFromPersistence(record: PrismaQuote): CrossChainQuote {
    return new CrossChainQuote({
      id: record.id,
      userId: record.userId,
      fromChain: record.fromChain,
      toChain: record.toChain,
      fromToken: record.fromToken,
      toToken: record.toToken,
      amount: record.amount.toString(),
      operationType: record.operationType,
      route: record.route as any,
      alternatives: (record.alternatives as any) || [],
      metadata: (record.metadata as any) || {},
      expiresAt: record.expiresAt,
      createdAt: record.createdAt
    });
  }

  private balanceToPersistence(balance: TacBalance): Prisma.TacBalanceCreateInput {
    return {
      id: balance.id,
      userId: balance.userId,
      tokenSymbol: balance.tokenSymbol,
      tokenAddress: balance.tokenAddress,
      balance: new Prisma.Decimal(balance.balance),
      sourceProtocol: balance.sourceProtocol,
      sourceChain: balance.sourceChain,
      protocolAddress: balance.protocolAddress,
      currentApy: balance.currentApy ? new Prisma.Decimal(balance.currentApy) : undefined,
      estimatedYield: balance.estimatedYield ? new Prisma.Decimal(balance.estimatedYield) : undefined,
      rewardsEarned: new Prisma.Decimal(balance.rewardsEarned || '0'),
      rewardsClaimed: new Prisma.Decimal(balance.rewardsClaimed || '0'),
      lastRewardCalc: balance.lastRewardCalc || new Date(),
      underlyingAsset: balance.underlyingAsset,
      conversionRate: balance.conversionRate ? new Prisma.Decimal(balance.conversionRate) : undefined,
      isActive: balance.isActive,
      canClaim: balance.canClaim,
      canRedeem: balance.canRedeem,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
      lastSyncAt: balance.lastSyncAt
    };
  }

  private balanceFromPersistence(record: PrismaBalance): TacBalance {
    return new TacBalance({
      id: record.id,
      userId: record.userId,
      tokenSymbol: record.tokenSymbol,
      tokenAddress: record.tokenAddress,
      balance: record.balance.toString(),
      sourceProtocol: record.sourceProtocol,
      sourceChain: record.sourceChain,
      protocolAddress: record.protocolAddress || undefined,
      currentApy: record.currentApy ? Number(record.currentApy) : undefined,
      estimatedYield: record.estimatedYield?.toString(),
      rewardsEarned: record.rewardsEarned.toString(),
      rewardsClaimed: record.rewardsClaimed.toString(),
      lastRewardCalc: record.lastRewardCalc || new Date(),
      underlyingAsset: record.underlyingAsset || undefined,
      conversionRate: record.conversionRate?.toString(),
      isActive: record.isActive,
      canClaim: record.canClaim,
      canRedeem: record.canRedeem,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastSyncAt: record.lastSyncAt
    });
  }

  private configurationFromPersistence(record: PrismaConfiguration) {
    return {
      userId: record.userId,
      defaultSlippage: Number(record.defaultSlippage),
      autoApprove: record.autoApprove,
      prioritizeSpeed: record.prioritizeSpeed,
      maxGasPrice: record.maxGasPrice ? Number(record.maxGasPrice) : undefined,
      notifyOnStart: record.notifyOnStart,
      notifyOnComplete: record.notifyOnComplete,
      notifyOnFailure: record.notifyOnFailure,
      pushNotifications: record.pushNotifications,
      preferredProtocols: record.preferredProtocols,
      blacklistedProtocols: record.blacklistedProtocols,
      maxOperationSize: record.maxOperationSize ? Number(record.maxOperationSize) : undefined,
      dailyOperationLimit: record.dailyOperationLimit ? Number(record.dailyOperationLimit) : undefined,
      requireConfirmation: record.requireConfirmation,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  // -------- Bridge providers --------
  async findBridgeProviders(activeOnly: boolean = true) {
    const providers = await this.prisma.tacBridgeProvider.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' }
    });

    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
      isActive: provider.isActive,
      isHealthy: provider.isHealthy,
      supportedChains: provider.supportedChains as unknown as string[],
      supportedTokens: provider.supportedTokens as unknown as string[],
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      averageLatency: provider.averageLatency,
      successRate: provider.successRate?.toString()
    }));
  }

  async updateBridgeProviderHealth(providerName: string, isHealthy: boolean, latencyMs?: number): Promise<void> {
    await this.prisma.tacBridgeProvider.updateMany({
      where: { name: providerName },
      data: {
        isHealthy,
        lastHealthCheck: new Date(),
        averageLatency: latencyMs
      }
    });
  }
}
