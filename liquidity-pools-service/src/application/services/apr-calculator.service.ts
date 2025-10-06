import { Position } from '../../domain/entities/position.entity';
import { Pool } from '../../domain/entities/pool.entity';

/**
 * APRCalculatorService
 *
 * Calcula APR (Annual Percentage Return) para posições LP
 * Considera:
 * - Fees earned
 * - Impermanent loss
 * - Time period
 * - Capital efficiency (V3/V4 vs V2)
 */
export class APRCalculatorService {
  /**
   * Calculate current APR for a position based on recent performance
   */
  async calculatePositionAPR(position: Position, pool: Pool): Promise<PositionAPR> {
    const baseAPR = this.calculateBaseFeeAPR(pool);
    const capitalEfficiency = this.calculateCapitalEfficiency(position, pool);
    const impermanentLoss = await this.estimateImpermanentLoss(position);

    // Adjust base APR by capital efficiency
    const adjustedAPR = baseAPR * capitalEfficiency;

    // Subtract estimated IL impact
    const netAPR = adjustedAPR - (impermanentLoss.annualizedImpact * 100);

    return {
      totalAPR: Math.max(0, netAPR),
      feeAPR: adjustedAPR,
      impermanentLoss: impermanentLoss.currentPercentage,
      capitalEfficiency,
      breakdown: {
        basePoolAPR: baseAPR,
        rangeMultiplier: capitalEfficiency,
        ilImpact: impermanentLoss.annualizedImpact * 100,
        netFeeAPR: adjustedAPR
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate base fee APR for the pool
   */
  private calculateBaseFeeAPR(pool: Pool): number {
    if (!pool.fees24h || !pool.tvl || pool.tvl === 0) {
      return 0;
    }

    // Annualize the 24h fees
    const annualFees = pool.fees24h * 365;
    return (annualFees / pool.tvl) * 100;
  }

  /**
   * Calculate capital efficiency multiplier for concentrated liquidity
   */
  private calculateCapitalEfficiency(position: Position, pool: Pool): number {
    if (position.protocol === 'v2') {
      return 1; // V2 is baseline (full range)
    }

    if (!position.tickLower || !position.tickUpper) {
      return 1;
    }

    // Calculate the range of the position
    const lowerPrice = this.tickToPrice(position.tickLower);
    const upperPrice = this.tickToPrice(position.tickUpper);
    const currentPrice = pool.getPrice();

    // If out of range, efficiency is 0
    if (currentPrice < lowerPrice || currentPrice > upperPrice) {
      return 0;
    }

    // Calculate range width as percentage of current price
    const rangeWidth = (upperPrice - lowerPrice) / currentPrice;

    // Capital efficiency is roughly inverse of range width
    // Tighter ranges = higher efficiency
    // This is a simplified calculation
    if (rangeWidth <= 0.1) return 10;    // 10% range = 10x efficiency
    if (rangeWidth <= 0.2) return 5;     // 20% range = 5x efficiency
    if (rangeWidth <= 0.5) return 2;     // 50% range = 2x efficiency
    return 1; // Wide range ≈ V2 efficiency
  }

  /**
   * Estimate impermanent loss for the position
   */
  private async estimateImpermanentLoss(position: Position): Promise<ImpermanentLossEstimate> {
    // For MVP, return simplified IL calculation
    // In production, this would need:
    // - Entry price vs current price
    // - Position composition changes
    // - Time-weighted calculations

    // Mock calculation for demonstration
    const mockPriceChange = 0.1; // 10% price change
    const ilPercentage = this.calculateILFromPriceChange(mockPriceChange);

    return {
      currentPercentage: ilPercentage,
      estimatedAnnual: ilPercentage * 4, // Assume quarterly volatility
      annualizedImpact: ilPercentage * 0.01, // Convert to decimal
      priceChangeRequired: mockPriceChange
    };
  }

  /**
   * Calculate impermanent loss from price change
   */
  private calculateILFromPriceChange(priceChangePercent: number): number {
    // IL formula: 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
    const priceRatio = 1 + priceChangePercent;
    const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
    return Math.abs(il) * 100; // Convert to percentage
  }

  /**
   * Get APR projections for different scenarios
   */
  async getAPRProjections(
    position: Position,
    pool: Pool
  ): Promise<APRProjection[]> {
    const baseAPR = await this.calculatePositionAPR(position, pool);

    return [
      {
        scenario: 'conservative',
        description: 'Low volatility, stable trading',
        projectedAPR: baseAPR.totalAPR * 0.7,
        assumptions: {
          volumeChange: -0.3,
          volatility: 'low',
          ilImpact: baseAPR.impermanentLoss * 0.5
        }
      },
      {
        scenario: 'moderate',
        description: 'Current market conditions',
        projectedAPR: baseAPR.totalAPR,
        assumptions: {
          volumeChange: 0,
          volatility: 'medium',
          ilImpact: baseAPR.impermanentLoss
        }
      },
      {
        scenario: 'optimistic',
        description: 'High volume, favorable conditions',
        projectedAPR: baseAPR.totalAPR * 1.5,
        assumptions: {
          volumeChange: 0.5,
          volatility: 'medium',
          ilImpact: baseAPR.impermanentLoss * 0.8
        }
      },
      {
        scenario: 'volatile',
        description: 'High volatility, potential IL',
        projectedAPR: baseAPR.totalAPR * 0.3,
        assumptions: {
          volumeChange: 0.2,
          volatility: 'high',
          ilImpact: baseAPR.impermanentLoss * 2
        }
      }
    ];
  }

  /**
   * Compare APR across different protocols
   */
  async compareProtocolAPRs(
    token0: string,
    token1: string,
    chainId: number
  ): Promise<ProtocolComparison[]> {
    // This would query actual pools for comparison
    // For MVP, return mock data
    return [
      {
        protocol: 'v2',
        estimatedAPR: 12.5,
        capitalRequired: 100, // Relative amount
        pros: ['No impermanent loss from range', 'Always earning fees'],
        cons: ['Lower capital efficiency', 'Lower fee rates'],
        riskLevel: 'low'
      },
      {
        protocol: 'v3',
        estimatedAPR: 25.8,
        capitalRequired: 40, // 40% of V2 amount for same exposure
        pros: ['Higher capital efficiency', 'Customizable ranges'],
        cons: ['Range management required', 'Impermanent loss risk'],
        riskLevel: 'medium'
      },
      {
        protocol: 'v4',
        estimatedAPR: 32.1,
        capitalRequired: 35, // Even better efficiency
        pros: ['Highest efficiency', 'Hook benefits', 'Lower gas costs'],
        cons: ['New technology', 'Hook risks', 'Complex management'],
        riskLevel: 'medium-high'
      }
    ];
  }

  /**
   * Calculate historical APR for a position
   */
  async calculateHistoricalAPR(
    position: Position,
    fromDate: Date,
    toDate: Date
  ): Promise<HistoricalAPR> {
    const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);

    // Mock calculation - in production, query historical data
    const mockFeesEarned = 150; // USD
    const mockCapitalDeployed = 10000; // USD
    const mockIL = 50; // USD impermanent loss

    const netProfit = mockFeesEarned - mockIL;
    const periodReturn = (netProfit / mockCapitalDeployed) * 100;
    const annualizedAPR = (periodReturn / daysDiff) * 365;

    return {
      periodAPR: periodReturn,
      annualizedAPR: Math.max(0, annualizedAPR),
      feesEarned: mockFeesEarned,
      impermanentLoss: mockIL,
      netProfit,
      period: {
        from: fromDate,
        to: toDate,
        days: Math.round(daysDiff)
      }
    };
  }

  private tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }
}

export interface PositionAPR {
  totalAPR: number;
  feeAPR: number;
  impermanentLoss: number;
  capitalEfficiency: number;
  breakdown: {
    basePoolAPR: number;
    rangeMultiplier: number;
    ilImpact: number;
    netFeeAPR: number;
  };
  lastUpdated: Date;
}

interface ImpermanentLossEstimate {
  currentPercentage: number;
  estimatedAnnual: number;
  annualizedImpact: number;
  priceChangeRequired: number;
}

interface APRProjection {
  scenario: string;
  description: string;
  projectedAPR: number;
  assumptions: {
    volumeChange: number;
    volatility: string;
    ilImpact: number;
  };
}

interface ProtocolComparison {
  protocol: 'v2' | 'v3' | 'v4';
  estimatedAPR: number;
  capitalRequired: number; // Relative to V2
  pros: string[];
  cons: string[];
  riskLevel: string;
}

interface HistoricalAPR {
  periodAPR: number;
  annualizedAPR: number;
  feesEarned: number;
  impermanentLoss: number;
  netProfit: number;
  period: {
    from: Date;
    to: Date;
    days: number;
  };
}