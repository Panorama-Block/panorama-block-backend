import {
  ILiquidityProvider,
  CreatePositionParams,
  ModifyPositionParams,
  PreparedTransaction,
  ApprovalStatus
} from '../../domain/ports/liquidity.port';
import { Position, Token } from '../../domain/entities/position.entity';

export class UniswapLPAPIAdapter implements ILiquidityProvider {
  private readonly baseURL = 'https://trade-api.gateway.uniswap.org/v1';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.UNISWAP_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[UniswapLPAPI] ⚠️ API key not configured - adapter disabled');
    }
  }

  async createPosition(params: CreatePositionParams): Promise<PreparedTransaction> {
    this.validateApiKey();

    console.log('[UniswapLPAPI] Creating position', {
      protocol: params.protocol,
      pair: `${params.token0}/${params.token1}`,
      chainId: params.chainId
    });

    // 1. IMPORTANTE: Check approval PRIMEIRO
    const approvalStatus = await this.checkApproval(params);

    if (approvalStatus.needsApproval) {
      throw new Error(
        'APPROVAL_REQUIRED: Tokens not approved. User must approve first via /lp/approve endpoint'
      );
    }

    // 2. Create position via Uniswap API
    const response = await fetch(`${this.baseURL}/lp/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        protocol: params.protocol.toUpperCase(), // 'V2', 'V3', 'V4'
        chainId: params.chainId,
        token0: params.token0,
        token1: params.token1,
        amount0: params.amount0.toString(),
        amount1: params.amount1.toString(),
        walletAddress: params.owner,
        slippageTolerance: params.slippageTolerance?.toString() || '0.5',
        // V3/V4 specific
        ...(params.tickLower !== undefined && { tickLower: params.tickLower }),
        ...(params.tickUpper !== undefined && { tickUpper: params.tickUpper }),
        ...(params.feeTier && { feeTier: params.feeTier }),
        // V4 specific
        ...(params.hookAddress && { hookAddress: params.hookAddress })
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap LP API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    return {
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || '0',
      gasLimit: data.transaction.gasLimit,
      chainId: params.chainId,
      description: `Create ${params.protocol.toUpperCase()} LP position`
    };
  }

  async increasePosition(params: ModifyPositionParams): Promise<PreparedTransaction> {
    this.validateApiKey();

    const response = await fetch(`${this.baseURL}/lp/increase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        positionId: params.positionId,
        liquidityDelta: params.liquidityDelta.toString(),
        walletAddress: params.owner,
        chainId: params.chainId,
        amount0Max: params.amount0Max?.toString(),
        amount1Max: params.amount1Max?.toString(),
        slippageTolerance: params.slippageTolerance?.toString() || '0.5'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap increase position error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    return {
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || '0',
      gasLimit: data.transaction.gasLimit,
      chainId: params.chainId,
      description: `Increase LP position liquidity`
    };
  }

  async decreasePosition(params: ModifyPositionParams): Promise<PreparedTransaction> {
    this.validateApiKey();

    const response = await fetch(`${this.baseURL}/lp/decrease`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        positionId: params.positionId,
        liquidityDelta: (-params.liquidityDelta).toString(), // Make negative for decrease
        walletAddress: params.owner,
        chainId: params.chainId,
        slippageTolerance: params.slippageTolerance?.toString() || '0.5'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap decrease position error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    return {
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || '0',
      gasLimit: data.transaction.gasLimit,
      chainId: params.chainId,
      description: `Decrease LP position liquidity`
    };
  }

  async collectFees(positionId: string, owner: string): Promise<PreparedTransaction> {
    this.validateApiKey();

    const response = await fetch(`${this.baseURL}/lp/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        positionId,
        walletAddress: owner
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap collect fees error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    return {
      to: data.transaction.to,
      data: data.transaction.data,
      value: '0',
      gasLimit: data.transaction.gasLimit,
      chainId: data.chainId,
      description: `Collect LP position fees`
    };
  }

  async getPosition(positionId: string, chainId: number): Promise<Position> {
    this.validateApiKey();

    const response = await fetch(
      `${this.baseURL}/lp/position?positionId=${positionId}&chainId=${chainId}`,
      {
        headers: { 'x-api-key': this.apiKey }
      }
    );

    if (!response.ok) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const data: any = await response.json();
    return this.parsePosition(data);
  }

  async getUserPositions(owner: string, chainId: number): Promise<Position[]> {
    this.validateApiKey();

    // Query via API endpoint (se disponível) ou via Subgraph fallback
    const response = await fetch(
      `${this.baseURL}/lp/positions?walletAddress=${owner}&chainId=${chainId}`,
      {
        headers: { 'x-api-key': this.apiKey }
      }
    );

    if (!response.ok) {
      // Fallback to subgraph if API endpoint não existe
      console.log('[UniswapLPAPI] Positions endpoint not available, using subgraph fallback');
      return this.getPositionsViaSubgraph(owner, chainId);
    }

    const data: any = await response.json();
    return data.positions.map((p: any) => this.parsePosition(p));
  }

  async checkApproval(params: CreatePositionParams): Promise<ApprovalStatus> {
    this.validateApiKey();

    const response = await fetch(`${this.baseURL}/lp/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        protocol: params.protocol.toUpperCase(),
        token0: params.token0,
        token1: params.token1,
        chainId: params.chainId,
        walletAddress: params.owner,
        amount0: params.amount0.toString(),
        amount1: params.amount1.toString()
      })
    });

    const data: any = await response.json();

    // Se API retorna transações de approval, significa que precisa aprovar
    return {
      needsApproval: Boolean(data.token0Approval || data.token1Approval),
      token0Approval: data.token0Approval ? {
        needed: true,
        spender: data.token0Approval.spender,
        amount: BigInt(data.token0Approval.amount)
      } : undefined,
      token1Approval: data.token1Approval ? {
        needed: true,
        spender: data.token1Approval.spender,
        amount: BigInt(data.token1Approval.amount)
      } : undefined
    };
  }

  async getApprovalTransactions(params: CreatePositionParams): Promise<PreparedTransaction[]> {
    const approvalStatus = await this.checkApproval(params);

    if (!approvalStatus.needsApproval) {
      return [];
    }

    const transactions: PreparedTransaction[] = [];

    if (approvalStatus.token0Approval?.needed) {
      transactions.push({
        to: params.token0,
        data: this.buildApprovalCalldata(
          approvalStatus.token0Approval.spender,
          approvalStatus.token0Approval.amount
        ),
        value: '0',
        chainId: params.chainId,
        description: 'Approve token0 for LP'
      });
    }

    if (approvalStatus.token1Approval?.needed) {
      transactions.push({
        to: params.token1,
        data: this.buildApprovalCalldata(
          approvalStatus.token1Approval.spender,
          approvalStatus.token1Approval.amount
        ),
        value: '0',
        chainId: params.chainId,
        description: 'Approve token1 for LP'
      });
    }

    return transactions;
  }

  private parsePosition(apiPosition: any): Position {
    return new Position(
      apiPosition.tokenId || apiPosition.id,
      apiPosition.protocol.toLowerCase() as 'v2' | 'v3' | 'v4',
      apiPosition.chainId,
      apiPosition.owner,
      apiPosition.poolId,
      {
        address: apiPosition.token0.address,
        symbol: apiPosition.token0.symbol,
        decimals: apiPosition.token0.decimals
      },
      {
        address: apiPosition.token1.address,
        symbol: apiPosition.token1.symbol,
        decimals: apiPosition.token1.decimals
      },
      BigInt(apiPosition.liquidity),
      apiPosition.tickLower,
      apiPosition.tickUpper,
      apiPosition.feeTier,
      apiPosition.hookAddress,
      apiPosition.unclaimedFees ? {
        token0: BigInt(apiPosition.unclaimedFees.token0),
        token1: BigInt(apiPosition.unclaimedFees.token1)
      } : undefined,
      new Date(apiPosition.createdAt || Date.now()),
      new Date(apiPosition.lastUpdated || Date.now())
    );
  }

  private async getPositionsViaSubgraph(owner: string, chainId: number): Promise<Position[]> {
    // TODO: Implementar query GraphQL ao subgraph da Uniswap
    // Ver: https://docs.uniswap.org/api/subgraph/overview
    console.warn('[UniswapLPAPI] Subgraph fallback not implemented yet');
    return [];
  }

  private buildApprovalCalldata(spender: string, amount: bigint): string {
    // ERC20 approve function signature: approve(address,uint256)
    const functionSignature = '0x095ea7b3';
    const paddedSpender = spender.replace('0x', '').padStart(64, '0');
    const paddedAmount = amount.toString(16).padStart(64, '0');

    return functionSignature + paddedSpender + paddedAmount;
  }

  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error('Uniswap API key not configured');
    }
  }
}