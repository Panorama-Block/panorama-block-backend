import { Position } from '../entities/position.entity';
import { Pool } from '../entities/pool.entity';

// For caching and persistence
export interface IPositionRepository {
  // Save position data
  savePosition(position: Position): Promise<void>;

  // Get position by ID
  getPosition(positionId: string, chainId: number): Promise<Position | null>;

  // Get user positions
  getUserPositions(owner: string, chainId?: number): Promise<Position[]>;

  // Update position data
  updatePosition(positionId: string, updates: Partial<Position>): Promise<void>;

  // Delete position
  deletePosition(positionId: string, chainId: number): Promise<void>;

  // Get positions by pool
  getPositionsByPool(poolId: string, chainId: number): Promise<Position[]>;

  // Search positions
  searchPositions(query: PositionQuery): Promise<Position[]>;
}

export interface IPoolRepository {
  // Save pool data
  savePool(pool: Pool): Promise<void>;

  // Get pool by ID
  getPool(poolId: string, chainId: number): Promise<Pool | null>;

  // Get pools
  getPools(query: PoolQuery): Promise<Pool[]>;

  // Update pool data
  updatePool(poolId: string, updates: Partial<Pool>): Promise<void>;

  // Cache pool metrics
  cachePoolMetrics(poolId: string, chainId: number, metrics: any): Promise<void>;

  // Get cached pool metrics
  getCachedPoolMetrics(poolId: string, chainId: number): Promise<any | null>;
}

export interface PositionQuery {
  owner?: string;
  chainId?: number;
  protocol?: 'v2' | 'v3' | 'v4';
  poolId?: string;
  isActive?: boolean; // Has liquidity > 0
  hasUnclaimedFees?: boolean;
  limit?: number;
  offset?: number;
}

export interface PoolQuery {
  chainId?: number;
  protocol?: 'v2' | 'v3' | 'v4';
  token0?: string;
  token1?: string;
  feeTier?: number;
  hasHooks?: boolean;
  minTvl?: number;
  limit?: number;
  offset?: number;
}

// For notification/alert storage
export interface IAlertRepository {
  // Save user alert preferences
  saveAlert(alert: UserAlert): Promise<void>;

  // Get user alerts
  getUserAlerts(userAddress: string): Promise<UserAlert[]>;

  // Update alert
  updateAlert(alertId: string, updates: Partial<UserAlert>): Promise<void>;

  // Delete alert
  deleteAlert(alertId: string): Promise<void>;

  // Get alerts to check
  getActiveAlerts(): Promise<UserAlert[]>;
}

export interface UserAlert {
  id: string;
  userAddress: string;
  positionId: string;
  chainId: number;
  type: AlertType;
  threshold?: number;
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
}

export type AlertType =
  | 'OUT_OF_RANGE'          // Position went out of range
  | 'APPROACHING_EDGE'      // Position approaching range edge (85%+)
  | 'FEES_THRESHOLD'        // Unclaimed fees exceed threshold
  | 'IL_THRESHOLD'          // Impermanent loss exceeds threshold
  | 'PRICE_CHANGE'          // Token price changed significantly
  | 'LIQUIDITY_LOW';        // Pool liquidity dropped significantly