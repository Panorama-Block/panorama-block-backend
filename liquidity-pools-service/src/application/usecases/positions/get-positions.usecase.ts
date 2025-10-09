import { ILiquidityProvider } from '../../../domain/ports/liquidity.port';
import { Position } from '../../../domain/entities/position.entity';
import { NotificationService } from '../../services/notification.service';
import { APRCalculatorService } from '../../services/apr-calculator.service';

export interface GetPositionsRequest {
  userAddress: string;
  chainId?: number;
  includeInactive?: boolean; // Include positions with 0 liquidity
  protocol?: 'v2' | 'v3' | 'v4';
}

export interface GetPositionsResponse {
  positions: EnrichedPosition[];
  summary: PositionsSummary;
  alerts: any[]; // Alerts from notification service
  recommendations: string[];
}

export interface EnrichedPosition {
  // Core position data
  id: string;
  protocol: 'v2' | 'v3' | 'v4';
  chainId: number;
  owner: string;
  poolId: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  liquidity: string; // BigInt as string

  // V3/V4 specific
  tickLower?: number;
  tickUpper?: number;
  feeTier?: number;

  // V4 specific
  hookAddress?: string;
  hookInfo?: {
    name: string;
    isSafe: boolean;
    category: string;
  };

  // Enriched data
  status: 'active' | 'out_of_range' | 'inactive';
  valueUSD?: number;
  unclaimedFeesUSD?: number;
  estimatedAPR?: number;
  rangeUsage?: number; // 0-1, where 0.5 is center

  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  description: string; // Human readable description
}

export interface PositionsSummary {
  totalPositions: number;
  activePositions: number;
  outOfRangePositions: number;
  totalValueUSD: number;
  totalUnclaimedFeesUSD: number;
  averageAPR: number;
  protocolBreakdown: {
    v2: number;
    v3: number;
    v4: number;
  };
}

export class GetPositionsUseCase {
  constructor(
    private readonly liquidityProvider: ILiquidityProvider,
    private readonly notificationService: NotificationService,
    private readonly aprCalculator: APRCalculatorService
  ) {}

  async execute(request: GetPositionsRequest): Promise<GetPositionsResponse> {
    console.log('[GetPositionsUseCase] Getting positions for user:', request.userAddress);

    // 1. Get raw positions from provider
    const rawPositions = await this.getRawPositions(request);

    // 2. Filter positions if needed
    const filteredPositions = this.filterPositions(rawPositions, request);

    // 3. Enrich positions with additional data
    const enrichedPositions = await this.enrichPositions(filteredPositions);

    // 4. Generate alerts
    const alerts = await this.notificationService.monitorPositions(
      request.userAddress,
      filteredPositions
    );

    // 5. Calculate summary
    const summary = this.calculateSummary(enrichedPositions);

    // 6. Generate recommendations
    const recommendations = this.generateRecommendations(enrichedPositions, alerts);

    return {
      positions: enrichedPositions,
      summary,
      alerts,
      recommendations
    };
  }

  private async getRawPositions(request: GetPositionsRequest): Promise<Position[]> {
    if (request.chainId) {
      // Get positions for specific chain
      return await this.liquidityProvider.getUserPositions(request.userAddress, request.chainId);
    }

    // Get positions across all chains
    const supportedChains = [1, 137, 8453, 42161, 43114, 56]; // Ethereum, Polygon, Base, Arbitrum, Avalanche, BSC
    const allPositions: Position[] = [];

    for (const chainId of supportedChains) {
      try {
        const positions = await this.liquidityProvider.getUserPositions(request.userAddress, chainId);
        allPositions.push(...positions);
      } catch (error) {
        console.error(`[GetPositionsUseCase] Error getting positions for chain ${chainId}:`, error);
        // Continue with other chains
      }
    }

    return allPositions;
  }

  private filterPositions(positions: Position[], request: GetPositionsRequest): Position[] {
    let filtered = positions;

    // Filter by protocol
    if (request.protocol) {
      filtered = filtered.filter(p => p.protocol === request.protocol);
    }

    // Filter inactive positions if not requested
    if (!request.includeInactive) {
      filtered = filtered.filter(p => p.liquidity > 0n);
    }

    return filtered;
  }

  private async enrichPositions(positions: Position[]): Promise<EnrichedPosition[]> {
    const enriched: EnrichedPosition[] = [];

    for (const position of positions) {
      try {
        const enrichedPosition = await this.enrichSinglePosition(position);
        enriched.push(enrichedPosition);
      } catch (error) {
        console.error(`[GetPositionsUseCase] Error enriching position ${position.id}:`, error);
        // Add position with minimal enrichment
        enriched.push(this.createMinimalEnrichedPosition(position));
      }
    }

    return enriched;
  }

  private async enrichSinglePosition(position: Position): Promise<EnrichedPosition> {
    // Calculate status
    const status = this.calculatePositionStatus(position);

    // Get hook info if V4
    let hookInfo;
    if (position.hasHook() && position.hookAddress) {
      // This would query the hooks detector
      hookInfo = {
        name: 'Unknown Hook',
        isSafe: false,
        category: 'unknown'
      };
    }

    // Calculate value estimates (mock for MVP)
    const valueUSD = this.estimatePositionValueUSD(position);
    const unclaimedFeesUSD = this.estimateUnclaimedFeesUSD(position);
    const estimatedAPR = this.estimatePositionAPR(position);
    const rangeUsage = this.calculateRangeUsage(position);

    return {
      id: position.id,
      protocol: position.protocol,
      chainId: position.chainId,
      owner: position.owner,
      poolId: position.poolId,
      token0: position.token0,
      token1: position.token1,
      liquidity: position.liquidity.toString(),
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      feeTier: position.feeTier,
      hookAddress: position.hookAddress,
      hookInfo,
      status,
      valueUSD,
      unclaimedFeesUSD,
      estimatedAPR,
      rangeUsage,
      createdAt: position.createdAt,
      lastUpdated: position.lastUpdated,
      description: position.getDescription()
    };
  }

  private createMinimalEnrichedPosition(position: Position): EnrichedPosition {
    return {
      id: position.id,
      protocol: position.protocol,
      chainId: position.chainId,
      owner: position.owner,
      poolId: position.poolId,
      token0: position.token0,
      token1: position.token1,
      liquidity: position.liquidity.toString(),
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      feeTier: position.feeTier,
      hookAddress: position.hookAddress,
      status: position.liquidity > 0n ? 'active' : 'inactive',
      createdAt: position.createdAt,
      lastUpdated: position.lastUpdated,
      description: position.getDescription()
    };
  }

  private calculatePositionStatus(position: Position): 'active' | 'out_of_range' | 'inactive' {
    if (position.liquidity === 0n) {
      return 'inactive';
    }

    if (position.protocol === 'v2') {
      return 'active'; // V2 is always in range
    }

    // For V3/V4, check if in range (mock current tick)
    const mockCurrentTick = 0; // In production, get from pool
    return position.isInRange(mockCurrentTick) ? 'active' : 'out_of_range';
  }

  private estimatePositionValueUSD(position: Position): number {
    // Mock calculation - in production, use real price data
    const liquidityValue = Number(position.liquidity) / 1e18;
    return liquidityValue * 2000; // Mock $2000 per liquidity unit
  }

  private estimateUnclaimedFeesUSD(position: Position): number {
    if (!position.unclaimedFees) return 0;

    // Mock calculation
    const fees0 = Number(position.unclaimedFees.token0) / (10 ** position.token0.decimals);
    const fees1 = Number(position.unclaimedFees.token1) / (10 ** position.token1.decimals);

    // Mock prices
    return (fees0 * 2000) + (fees1 * 1); // $2000 for token0, $1 for token1
  }

  private estimatePositionAPR(position: Position): number {
    // Mock APR based on protocol
    const baseAPR = {
      'v2': 8,
      'v3': 15,
      'v4': 20
    };

    return baseAPR[position.protocol] || 10;
  }

  private calculateRangeUsage(position: Position): number | undefined {
    if (position.protocol === 'v2') return 0.5; // Always centered for V2

    if (!position.tickLower || !position.tickUpper) return undefined;

    // Mock current tick
    const mockCurrentTick = 0;
    return position.getRangeUsage(mockCurrentTick);
  }

  private calculateSummary(positions: EnrichedPosition[]): PositionsSummary {
    const totalPositions = positions.length;
    const activePositions = positions.filter(p => p.status === 'active').length;
    const outOfRangePositions = positions.filter(p => p.status === 'out_of_range').length;

    const totalValueUSD = positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0);
    const totalUnclaimedFeesUSD = positions.reduce((sum, p) => sum + (p.unclaimedFeesUSD || 0), 0);

    const aprValues = positions.filter(p => p.estimatedAPR).map(p => p.estimatedAPR!);
    const averageAPR = aprValues.length > 0 ? aprValues.reduce((sum, apr) => sum + apr, 0) / aprValues.length : 0;

    const protocolBreakdown = {
      v2: positions.filter(p => p.protocol === 'v2').length,
      v3: positions.filter(p => p.protocol === 'v3').length,
      v4: positions.filter(p => p.protocol === 'v4').length
    };

    return {
      totalPositions,
      activePositions,
      outOfRangePositions,
      totalValueUSD,
      totalUnclaimedFeesUSD,
      averageAPR,
      protocolBreakdown
    };
  }

  private generateRecommendations(positions: EnrichedPosition[], alerts: any[]): string[] {
    const recommendations: string[] = [];

    // Out of range recommendations
    const outOfRange = positions.filter(p => p.status === 'out_of_range').length;
    if (outOfRange > 0) {
      recommendations.push(`${outOfRange} position(s) are out of range - consider rebalancing to resume earning fees`);
    }

    // Fees recommendations
    const highFees = positions.filter(p => (p.unclaimedFeesUSD || 0) > 10).length;
    if (highFees > 0) {
      recommendations.push(`${highFees} position(s) have substantial unclaimed fees - consider collecting`);
    }

    // Protocol upgrade recommendations
    const v2Positions = positions.filter(p => p.protocol === 'v2').length;
    if (v2Positions > 0) {
      recommendations.push(`Consider migrating V2 positions to V3/V4 for better capital efficiency`);
    }

    // Diversification recommendations
    if (positions.length === 1) {
      recommendations.push('Consider diversifying across multiple pools to reduce risk');
    }

    // No positions recommendation
    if (positions.length === 0) {
      recommendations.push('Start providing liquidity to earn fees from trading activity');
    }

    return recommendations;
  }
}