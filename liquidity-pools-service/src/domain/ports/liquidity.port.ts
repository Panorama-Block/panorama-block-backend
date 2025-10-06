import { Position } from '../entities/position.entity';

export interface ILiquidityProvider {
  // Create new position
  createPosition(params: CreatePositionParams): Promise<PreparedTransaction>;

  // Modify existing position
  increasePosition(params: ModifyPositionParams): Promise<PreparedTransaction>;
  decreasePosition(params: ModifyPositionParams): Promise<PreparedTransaction>;

  // Collect fees
  collectFees(positionId: string, owner: string): Promise<PreparedTransaction>;

  // Get position details
  getPosition(positionId: string, chainId: number): Promise<Position>;

  // List user positions
  getUserPositions(owner: string, chainId: number): Promise<Position[]>;

  // Check if tokens need approval
  checkApproval(params: CreatePositionParams): Promise<ApprovalStatus>;

  // Get approval transactions
  getApprovalTransactions(params: CreatePositionParams): Promise<PreparedTransaction[]>;
}

export interface CreatePositionParams {
  protocol: 'v2' | 'v3' | 'v4';
  chainId: number;
  token0: string;
  token1: string;
  amount0: bigint;
  amount1: bigint;
  owner: string;
  // V3/V4 specific
  tickLower?: number;
  tickUpper?: number;
  feeTier?: number;
  // V4 specific
  hookAddress?: string;
  // Slippage protection
  slippageTolerance?: number; // 0.5 = 0.5%
}

export interface ModifyPositionParams {
  positionId: string;
  owner: string;
  liquidityDelta: bigint; // positive = increase, negative = decrease
  chainId: number;
  // For increase liquidity
  amount0Max?: bigint;
  amount1Max?: bigint;
  // Slippage protection
  slippageTolerance?: number;
}

export interface PreparedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  chainId: number;
  description?: string; // Human readable description
}

export interface ApprovalStatus {
  needsApproval: boolean;
  token0Approval?: {
    needed: boolean;
    spender: string;
    amount: bigint;
  };
  token1Approval?: {
    needed: boolean;
    spender: string;
    amount: bigint;
  };
}

// For position migration between protocols
export interface MigrationParams {
  fromPositionId: string;
  targetProtocol: 'v2' | 'v3' | 'v4';
  owner: string;
  chainId: number;
  // V3/V4 specific for target
  newTickLower?: number;
  newTickUpper?: number;
  newFeeTier?: number;
  // V4 specific
  newHookAddress?: string;
  slippageTolerance?: number;
}