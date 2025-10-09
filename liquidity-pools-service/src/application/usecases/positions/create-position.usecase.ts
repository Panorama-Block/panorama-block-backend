import { ILiquidityProvider, CreatePositionParams, PreparedTransaction } from '../../../domain/ports/liquidity.port';
import { HooksDetectorAdapter } from '../../../infrastructure/adapters/hooks-detector.adapter';
import { TickMathService } from '../../services/tick-math.service';
import { APRCalculatorService } from '../../services/apr-calculator.service';
import { getTokenDecimals } from '../../../utils/token.utils';

export interface CreatePositionRequest {
  protocol: 'v2' | 'v3' | 'v4';
  chainId: number;
  token0: string;
  token1: string;
  amount0: string; // human-readable (ex: "1.5")
  amount1: string;
  userAddress: string;
  // V3/V4 specific
  priceRange?: {
    lower: number; // price in token0/token1
    upper: number;
  };
  feeTier?: number; // ex: 3000 = 0.3%
  // V4 specific
  hookAddress?: string;
  slippageTolerance?: number; // 0.5 = 0.5%
}

export interface CreatePositionResponse {
  needsApproval: boolean;
  approvalTransactions?: PreparedTransaction[];
  createTransaction?: PreparedTransaction;
  positionPreview: {
    estimatedLiquidity: string;
    priceRange?: { lower: number; upper: number };
    estimatedAPR?: number;
    capitalEfficiency?: number;
  };
  hookInfo?: {
    name: string;
    description: string;
    isSafe: boolean;
    warning?: string;
    riskLevel: string;
  };
  recommendations?: string[];
}

export class CreatePositionUseCase {
  constructor(
    private readonly liquidityProvider: ILiquidityProvider,
    private readonly tickMathService: TickMathService,
    private readonly hooksDetector: HooksDetectorAdapter,
    private readonly aprCalculator: APRCalculatorService
  ) {}

  async execute(request: CreatePositionRequest): Promise<CreatePositionResponse> {
    console.log('[CreatePositionUseCase] Creating position', {
      protocol: request.protocol,
      pair: `${request.token0}/${request.token1}`,
      userAddress: request.userAddress
    });

    // 1. Validate hook if V4
    let hookInfo: any;
    if (request.protocol === 'v4' && request.hookAddress) {
      const hookValidation = await this.hooksDetector.validateHook(
        request.hookAddress,
        request.chainId
      );

      hookInfo = {
        name: hookValidation.name,
        description: hookValidation.description,
        isSafe: hookValidation.isSafe,
        warning: hookValidation.warning,
        riskLevel: hookValidation.isSafe ? 'low' : 'high'
      };

      // Check if hook is safe for add liquidity operation
      const isSafeForOperation = await this.hooksDetector.isHookSafeForOperation(
        request.hookAddress,
        'addLiquidity',
        request.chainId
      );

      if (!isSafeForOperation) {
        throw new Error(
          `Hook ${request.hookAddress} may interfere with liquidity provision. Please review the risks.`
        );
      }
    }

    // 2. Convert price range to ticks (V3/V4)
    let tickLower: number | undefined;
    let tickUpper: number | undefined;
    let actualPriceRange: { lower: number; upper: number } | undefined;

    if (request.protocol !== 'v2' && request.priceRange) {
      const feeTier = request.feeTier || 3000;
      const tickSpacing = this.tickMathService.getTickSpacingForFeeTier(feeTier);

      const range = this.tickMathService.getPriceRangeTicks(
        request.priceRange.lower,
        request.priceRange.upper,
        tickSpacing
      );

      tickLower = range.tickLower;
      tickUpper = range.tickUpper;

      // Get actual prices after tick alignment
      actualPriceRange = {
        lower: this.tickMathService.tickToPrice(tickLower),
        upper: this.tickMathService.tickToPrice(tickUpper)
      };
    }

    // 3. Convert amounts to wei
    const token0Decimals = await getTokenDecimals(request.chainId, request.token0);
    const token1Decimals = await getTokenDecimals(request.chainId, request.token1);

    const amount0 = this.toWei(request.amount0, token0Decimals);
    const amount1 = this.toWei(request.amount1, token1Decimals);

    // 4. Prepare params
    const params: CreatePositionParams = {
      protocol: request.protocol,
      chainId: request.chainId,
      token0: request.token0,
      token1: request.token1,
      amount0,
      amount1,
      owner: request.userAddress,
      tickLower,
      tickUpper,
      feeTier: request.feeTier,
      hookAddress: request.hookAddress,
      slippageTolerance: request.slippageTolerance || 0.5
    };

    // 5. Check if approval is needed
    const approvalStatus = await this.liquidityProvider.checkApproval(params);

    if (approvalStatus.needsApproval) {
      const approvalTransactions = await this.liquidityProvider.getApprovalTransactions(params);

      return {
        needsApproval: true,
        approvalTransactions,
        positionPreview: {
          estimatedLiquidity: this.estimateLiquidity(amount0, amount1).toString(),
          priceRange: actualPriceRange
        },
        hookInfo,
        recommendations: this.generateRecommendations(request)
      };
    }

    // 6. Create position
    try {
      const createTransaction = await this.liquidityProvider.createPosition(params);

      // 7. Calculate position preview
      const estimatedLiquidity = this.estimateLiquidity(amount0, amount1);
      const positionPreview = {
        estimatedLiquidity: estimatedLiquidity.toString(),
        priceRange: actualPriceRange
      };

      // 8. Add APR estimates if possible
      if (request.protocol !== 'v2') {
        // Mock APR calculation for preview
        positionPreview.estimatedAPR = this.estimateAPR(request.protocol, request.feeTier);
        positionPreview.capitalEfficiency = this.estimateCapitalEfficiency(request.protocol, actualPriceRange);
      }

      return {
        needsApproval: false,
        createTransaction,
        positionPreview,
        hookInfo,
        recommendations: this.generateRecommendations(request)
      };

    } catch (error: any) {
      console.error('[CreatePositionUseCase] Error creating position:', error);
      throw new Error(`Failed to create position: ${error.message}`);
    }
  }

  private toWei(amountHuman: string, decimals: number): bigint {
    const [intPart, fracPart = ""] = amountHuman.split(".");
    const normalized = (intPart || "0") + fracPart.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(normalized === "" ? "0" : normalized);
  }

  private estimateLiquidity(amount0: bigint, amount1: bigint): bigint {
    // Simplified liquidity calculation
    // In production, this would use proper math based on current price and range
    return (amount0 + amount1) / 2n;
  }

  private estimateAPR(protocol: 'v2' | 'v3' | 'v4', feeTier?: number): number {
    // Mock APR estimates based on protocol and fee tier
    const baseAPR: { [key: string]: number } = {
      'v2': 8,
      'v3': 15,
      'v4': 20
    };

    let apr = baseAPR[protocol] || 10;

    // Adjust for fee tier
    if (feeTier) {
      if (feeTier === 500) apr *= 0.7;   // Lower fee = lower base yield
      if (feeTier === 10000) apr *= 1.3; // Higher fee = higher base yield
    }

    return apr;
  }

  private estimateCapitalEfficiency(protocol: 'v2' | 'v3' | 'v4', priceRange?: { lower: number; upper: number }): number {
    if (protocol === 'v2') return 1;

    if (!priceRange) return 1;

    // Simplified efficiency calculation
    const rangeWidth = (priceRange.upper - priceRange.lower) / priceRange.lower;

    if (rangeWidth <= 0.1) return 8;   // 10% range = 8x efficiency
    if (rangeWidth <= 0.2) return 4;   // 20% range = 4x efficiency
    if (rangeWidth <= 0.5) return 2;   // 50% range = 2x efficiency
    return 1;
  }

  private generateRecommendations(request: CreatePositionRequest): string[] {
    const recommendations: string[] = [];

    // Protocol recommendations
    if (request.protocol === 'v2') {
      recommendations.push('Consider V3 for better capital efficiency with concentrated liquidity');
    } else if (request.protocol === 'v3' && !request.priceRange) {
      recommendations.push('Set a price range to maximize capital efficiency');
    } else if (request.protocol === 'v4' && !request.hookAddress) {
      recommendations.push('Explore available hooks to enhance your position performance');
    }

    // Range recommendations
    if (request.priceRange) {
      const rangeWidth = (request.priceRange.upper - request.priceRange.lower) / request.priceRange.lower;
      if (rangeWidth > 0.5) {
        recommendations.push('Consider a tighter range for higher capital efficiency');
      } else if (rangeWidth < 0.05) {
        recommendations.push('Very tight range increases out-of-range risk - monitor closely');
      }
    }

    // Fee tier recommendations
    if (request.feeTier === 100) {
      recommendations.push('0.01% fee tier is for very stable pairs - ensure low volatility');
    } else if (request.feeTier === 10000) {
      recommendations.push('1% fee tier is for exotic pairs - higher risk but potentially higher rewards');
    }

    return recommendations;
  }
}