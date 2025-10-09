import { Position } from '../../domain/entities/position.entity';

/**
 * NotificationService
 *
 * Monitora posições LP e gera alertas:
 * - Out of range (V3/V4)
 * - Approaching range edge (85%+)
 * - Unclaimed fees > threshold
 * - Impermanent loss warnings
 */
export class NotificationService {
  constructor(
    private readonly redisClient?: any // Redis client for caching alerts
  ) {}

  async monitorPositions(userAddress: string, positions: Position[]): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const position of positions) {
      // Skip V2 (sempre in range)
      if (position.protocol === 'v2') {
        // Only check fees for V2
        const feesAlert = await this.checkUnclaimedFees(position);
        if (feesAlert) alerts.push(feesAlert);
        continue;
      }

      // Get current tick from pool (TODO: integrate with pool service)
      const currentTick = await this.getCurrentTick(position.poolId, position.chainId);

      // 1. Out of range check
      if (!position.isInRange(currentTick)) {
        alerts.push({
          id: `out_of_range_${position.id}`,
          type: 'OUT_OF_RANGE',
          severity: 'high',
          positionId: position.id,
          userAddress,
          title: 'Position Out of Range',
          message: `${position.token0.symbol}/${position.token1.symbol} position is out of range and not earning fees`,
          action: 'REBALANCE',
          actionUrl: `/positions/${position.id}/rebalance`,
          timestamp: new Date(),
          data: {
            currentTick,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            protocol: position.protocol
          }
        });
      }

      // 2. Approaching edge check
      const rangeUsage = position.getRangeUsage(currentTick);
      if (rangeUsage > 0.85 || rangeUsage < 0.15) {
        alerts.push({
          id: `approaching_edge_${position.id}`,
          type: 'APPROACHING_EDGE',
          severity: 'medium',
          positionId: position.id,
          userAddress,
          title: 'Position Near Range Edge',
          message: `Position at ${Math.round(rangeUsage * 100)}% of range - consider rebalancing soon`,
          action: 'MONITOR',
          actionUrl: `/positions/${position.id}`,
          timestamp: new Date(),
          data: {
            rangeUsage,
            currentTick,
            protocol: position.protocol
          }
        });
      }

      // 3. Unclaimed fees check
      const feesAlert = await this.checkUnclaimedFees(position);
      if (feesAlert) alerts.push(feesAlert);

      // 4. Impermanent loss warning (if we can calculate it)
      const ilAlert = await this.checkImpermanentLoss(position);
      if (ilAlert) alerts.push(ilAlert);
    }

    // Store alerts in cache if Redis is available
    if (this.redisClient && alerts.length > 0) {
      await this.cacheAlerts(userAddress, alerts);
    }

    return alerts;
  }

  async getStoredAlerts(userAddress: string): Promise<Alert[]> {
    if (!this.redisClient) return [];

    try {
      const cached = await this.redisClient.get(`alerts:${userAddress}`);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('[NotificationService] Error getting cached alerts:', error);
      return [];
    }
  }

  async dismissAlert(userAddress: string, alertId: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      const alerts = await this.getStoredAlerts(userAddress);
      const filtered = alerts.filter(alert => alert.id !== alertId);
      await this.cacheAlerts(userAddress, filtered);
    } catch (error) {
      console.error('[NotificationService] Error dismissing alert:', error);
    }
  }

  private async checkUnclaimedFees(position: Position): Promise<Alert | null> {
    if (!position.unclaimedFees) return null;

    const feesUSD = await this.calculateFeesUSD(position.unclaimedFees, position);
    const threshold = this.getFeesThreshold(position.protocol);

    if (feesUSD > threshold) {
      return {
        id: `fees_ready_${position.id}`,
        type: 'FEES_READY',
        severity: 'low',
        positionId: position.id,
        userAddress: position.owner,
        title: 'Fees Ready to Collect',
        message: `$${feesUSD.toFixed(2)} in fees ready to collect`,
        action: 'COLLECT',
        actionUrl: `/positions/${position.id}/collect`,
        timestamp: new Date(),
        data: {
          feesUSD,
          token0Fees: position.unclaimedFees.token0.toString(),
          token1Fees: position.unclaimedFees.token1.toString()
        }
      };
    }

    return null;
  }

  private async checkImpermanentLoss(position: Position): Promise<Alert | null> {
    // TODO: Implement IL calculation
    // Would need:
    // - Entry price when position was created
    // - Current price
    // - Position amounts
    // - Calculate IL percentage

    // For MVP, we'll skip this
    return null;
  }

  private async getCurrentTick(poolId: string, chainId: number): Promise<number> {
    // TODO: Query pool current tick via API or subgraph
    // For MVP, return mock data
    return 0;
  }

  private async calculateFeesUSD(
    fees: { token0: bigint; token1: bigint },
    position: Position
  ): Promise<number> {
    // TODO: Convert fees to USD using price service
    // For MVP, use mock calculation
    const token0Value = Number(fees.token0) / (10 ** position.token0.decimals);
    const token1Value = Number(fees.token1) / (10 ** position.token1.decimals);

    // Mock prices - in production, use real price API
    const mockPrice0 = 2000; // Mock ETH price
    const mockPrice1 = 1; // Mock USDC price

    return (token0Value * mockPrice0) + (token1Value * mockPrice1);
  }

  private getFeesThreshold(protocol: 'v2' | 'v3' | 'v4'): number {
    // Different thresholds based on protocol
    switch (protocol) {
      case 'v2': return 5;   // $5 for V2
      case 'v3': return 10;  // $10 for V3
      case 'v4': return 10;  // $10 for V4
      default: return 10;
    }
  }

  private async cacheAlerts(userAddress: string, alerts: Alert[]): Promise<void> {
    if (!this.redisClient) return;

    try {
      const ttl = 3600; // 1 hour
      await this.redisClient.setex(
        `alerts:${userAddress}`,
        ttl,
        JSON.stringify(alerts)
      );
    } catch (error) {
      console.error('[NotificationService] Error caching alerts:', error);
    }
  }

  /**
   * Get alert statistics for user
   */
  getAlertStats(alerts: Alert[]): AlertStats {
    const byType = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<AlertType, number>);

    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<'low' | 'medium' | 'high', number>);

    return {
      total: alerts.length,
      byType,
      bySeverity,
      hasHighPriority: alerts.some(a => a.severity === 'high'),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate recommendations based on alerts
   */
  getRecommendations(alerts: Alert[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const outOfRange = alerts.filter(a => a.type === 'OUT_OF_RANGE').length;
    const approachingEdge = alerts.filter(a => a.type === 'APPROACHING_EDGE').length;
    const feesReady = alerts.filter(a => a.type === 'FEES_READY').length;

    if (outOfRange > 0) {
      recommendations.push({
        type: 'rebalance',
        priority: 'high',
        title: 'Rebalance Out-of-Range Positions',
        description: `You have ${outOfRange} position(s) that are out of range and not earning fees`,
        action: 'Rebalance positions to start earning fees again'
      });
    }

    if (feesReady > 0) {
      recommendations.push({
        type: 'collect',
        priority: 'medium',
        title: 'Collect Accumulated Fees',
        description: `You have ${feesReady} position(s) with substantial fees ready to collect`,
        action: 'Collect fees to realize your earnings'
      });
    }

    if (approachingEdge > 0) {
      recommendations.push({
        type: 'monitor',
        priority: 'low',
        title: 'Monitor Range Positions',
        description: `${approachingEdge} position(s) are approaching their range edges`,
        action: 'Keep an eye on these positions for potential rebalancing'
      });
    }

    return recommendations;
  }
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high';
  positionId: string;
  userAddress: string;
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
  timestamp: Date;
  data?: any;
}

export type AlertType =
  | 'OUT_OF_RANGE'
  | 'APPROACHING_EDGE'
  | 'FEES_READY'
  | 'IMPERMANENT_LOSS'
  | 'PRICE_CHANGE'
  | 'LIQUIDITY_LOW';

interface AlertStats {
  total: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<'low' | 'medium' | 'high', number>;
  hasHighPriority: boolean;
  lastUpdated: Date;
}

interface Recommendation {
  type: 'rebalance' | 'collect' | 'monitor' | 'migrate';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
}