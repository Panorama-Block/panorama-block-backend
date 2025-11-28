import { PrismaClient } from '@prisma/client';
import { ITacAnalyticsService, DashboardTimeframe, OperationMetrics, UserInsights } from '../../domain/interfaces/ITacAnalyticsService';
import { TacOperation } from '../../domain/entities/TacOperation';
import { CrossChainQuote } from '../../domain/entities/CrossChainQuote';

interface AnalyticsOptions {
  enableAnalytics: boolean;
}

export class TacAnalyticsService implements ITacAnalyticsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: AnalyticsOptions
  ) {}

  private isEnabled() {
    return this.options.enableAnalytics;
  }

  async trackOperationCreated(operation: TacOperation): Promise<void> {
    if (!this.isEnabled()) return;
    await this.prisma.tacAnalytics.create({
      data: {
        operationType: operation.operationType,
        sourceChain: operation.sourceChain,
        targetChain: operation.targetChain,
        protocol: operation.protocol,
        volumeUSD: 0,
        feesPaidUSD: 0,
        success: false,
        durationSeconds: 0,
        userHash: this.hashUser(operation.userId),
        date: new Date(),
        metadata: { status: 'created' }
      }
    });
  }

  async trackOperationCompleted(operation: TacOperation): Promise<void> {
    if (!this.isEnabled()) return;
    await this.prisma.tacAnalytics.create({
      data: {
        operationType: operation.operationType,
        sourceChain: operation.sourceChain,
        targetChain: operation.targetChain,
        protocol: operation.protocol,
        volumeUSD: Number(operation.outputAmount || operation.inputAmount),
        feesPaidUSD: Number(operation.totalFees || 0),
        success: true,
        durationSeconds: operation.actualTime ? Math.round(operation.actualTime / 1000) : 0,
        userHash: this.hashUser(operation.userId),
        date: new Date(),
        metadata: { status: 'completed' }
      }
    });
  }

  async trackOperationFailed(operation: TacOperation, reason: string): Promise<void> {
    if (!this.isEnabled()) return;
    await this.prisma.tacAnalytics.create({
      data: {
        operationType: operation.operationType,
        sourceChain: operation.sourceChain,
        targetChain: operation.targetChain,
        protocol: operation.protocol,
        volumeUSD: Number(operation.inputAmount),
        feesPaidUSD: 0,
        success: false,
        durationSeconds: operation.actualTime ? Math.round(operation.actualTime / 1000) : 0,
        userHash: this.hashUser(operation.userId),
        date: new Date(),
        metadata: { status: 'failed', reason }
      }
    });
  }

  async trackQuoteGenerated(quote: CrossChainQuote): Promise<void> {
    if (!this.isEnabled()) return;
    await this.prisma.tacAnalytics.create({
      data: {
        operationType: quote.operationType,
        sourceChain: quote.fromChain,
        targetChain: quote.toChain,
        protocol: quote.route.provider,
        volumeUSD: Number(quote.amount),
        feesPaidUSD: Number(quote.route.totalFees.total),
        success: false,
        durationSeconds: quote.route.totalTime,
        userHash: this.hashUser(quote.userId),
        date: new Date(),
        metadata: { type: 'quote' }
      }
    });
  }

  async getDashboardMetrics(timeframe: DashboardTimeframe): Promise<OperationMetrics> {
    const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 24 * 7 : 24 * 30;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [totals, success, averageDuration, protocols, chains] = await Promise.all([
      this.prisma.tacAnalytics.count({ where: { date: { gte: since } } }),
      this.prisma.tacAnalytics.count({ where: { date: { gte: since }, success: true } }),
      this.prisma.tacAnalytics.aggregate({
        where: { date: { gte: since } },
        _avg: { durationSeconds: true }
      }),
      this.prisma.tacAnalytics.groupBy({
        by: ['protocol'],
        where: { date: { gte: since }, protocol: { not: null } },
        _sum: { volumeUSD: true },
        _count: { protocol: true },
        orderBy: { _sum: { volumeUSD: 'desc' } },
        take: 5
      }),
      this.prisma.tacAnalytics.groupBy({
        by: ['sourceChain'],
        where: { date: { gte: since } },
        _sum: { volumeUSD: true }
      })
    ]);

    const totalVolume = await this.prisma.tacAnalytics.aggregate({
      where: { date: { gte: since } },
      _sum: { volumeUSD: true }
    });

    return {
      totalOperations: totals,
      totalVolumeUSD: Number(totalVolume._sum.volumeUSD || 0),
      successRate: totals === 0 ? 0 : Math.round((success / totals) * 100),
      averageCompletionTime: averageDuration._avg.durationSeconds || 0,
      topProtocols: protocols.map(p => ({
        protocol: p.protocol || 'unknown',
        volumeUSD: Number(p._sum.volumeUSD || 0),
        operations: p._count.protocol
      })),
      chainDistribution: chains.map(chain => ({
        chain: chain.sourceChain,
        volumeUSD: Number(chain._sum.volumeUSD || 0),
        percentage: totalVolume._sum.volumeUSD
          ? Math.round((Number(chain._sum.volumeUSD || 0) / Number(totalVolume._sum.volumeUSD || 1)) * 100)
          : 0
      }))
    };
  }

  async getUserInsights(userId: string): Promise<UserInsights> {
    const userHash = this.hashUser(userId);
    const [totals, protocols, avgSize] = await Promise.all([
      this.prisma.tacAnalytics.count({ where: { userHash } }),
      this.prisma.tacAnalytics.groupBy({
        by: ['protocol'],
        where: { userHash, protocol: { not: null } },
        _sum: { volumeUSD: true },
        orderBy: { _sum: { volumeUSD: 'desc' } },
        take: 3
      }),
      this.prisma.tacAnalytics.aggregate({
        where: { userHash, success: true },
        _avg: { volumeUSD: true }
      })
    ]);

    return {
      totalOperations: totals,
      totalVolumeUSD: protocols.reduce((sum, p) => sum + Number(p._sum.volumeUSD || 0), 0),
      favoriteProtocols: protocols.map(p => p.protocol || 'unknown'),
      averageOperationSizeUSD: Number(avgSize._avg.volumeUSD || 0),
      riskProfile: 'moderate',
      recommendedProtocols: protocols.map(p => p.protocol || 'unknown')
    };
  }

  private hashUser(userId: string): string {
    return Buffer.from(userId).toString('base64');
  }
}
