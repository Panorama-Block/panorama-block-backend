import { Pool } from '../entities/pool.entity';

export interface IPoolProvider {
  // Discover pools
  discoverPools(params: DiscoverPoolsParams): Promise<Pool[]>;

  // Get specific pool details
  getPool(poolId: string, chainId: number): Promise<Pool>;

  // Get pools for a token pair
  getPoolsForPair(token0: string, token1: string, chainId: number): Promise<Pool[]>;

  // Get trending/popular pools
  getTrendingPools(chainId: number, limit?: number): Promise<Pool[]>;

  // Search pools by token symbols
  searchPools(query: string, chainId: number, limit?: number): Promise<Pool[]>;
}

export interface DiscoverPoolsParams {
  chainId: number;
  protocols?: ('v2' | 'v3' | 'v4')[];
  minTvl?: number; // Minimum TVL in USD
  minVolume24h?: number; // Minimum 24h volume in USD
  feeTiers?: number[]; // Filter by fee tiers (e.g., [500, 3000, 10000])
  hasHooks?: boolean; // V4 only - filter by hook presence
  includeInactive?: boolean; // Include pools with low activity
  sortBy?: PoolSortOption;
  limit?: number;
  offset?: number;
}

export type PoolSortOption =
  | 'tvl_desc'
  | 'tvl_asc'
  | 'volume_desc'
  | 'volume_asc'
  | 'apr_desc'
  | 'apr_asc'
  | 'created_desc'
  | 'created_asc';

export interface PoolSearchResult {
  pools: Pool[];
  totalCount: number;
  hasMore: boolean;
}

// For pool analytics
export interface PoolMetrics {
  poolId: string;
  chainId: number;
  tvl: number; // USD
  volume24h: number; // USD
  volume7d: number; // USD
  fees24h: number; // USD
  fees7d: number; // USD
  apr: number; // Annualized percentage return
  priceChange24h: number; // Percentage change
  liquidityChange24h: number; // Percentage change
  lastUpdated: Date;
}

// For pool history/charts
export interface PoolHistoryData {
  timestamp: Date;
  tvl: number;
  volume: number;
  fees: number;
  price: number;
  tick?: number; // V3/V4 only
}

export interface IPoolAnalytics {
  // Get pool metrics
  getPoolMetrics(poolId: string, chainId: number): Promise<PoolMetrics>;

  // Get historical data
  getPoolHistory(
    poolId: string,
    chainId: number,
    timeframe: '1h' | '1d' | '1w' | '1m',
    from?: Date,
    to?: Date
  ): Promise<PoolHistoryData[]>;

  // Get top gainers/losers
  getTopPools(
    chainId: number,
    metric: 'volume' | 'tvl' | 'fees' | 'apr',
    timeframe: '24h' | '7d' | '30d',
    limit?: number
  ): Promise<Pool[]>;
}