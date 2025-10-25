/**
 * Cache Adapter - Redis Implementation
 *
 * Provides caching for:
 * - Swap quotes (TTL: 30s)
 * - Token approvals (TTL: 5min)
 * - Token metadata (TTL: 1 hour)
 *
 * Features:
 * - Automatic reconnection
 * - Graceful fallback (if Redis unavailable)
 * - TTL management
 * - Cache invalidation
 */

import { createClient, RedisClientType } from 'redis';
import { SwapQuote } from '../../domain/entities/swap';

export interface CacheConfig {
  url?: string;
  password?: string;
  defaultTTL?: number; // seconds
  enableLogging?: boolean;
}

interface ResolvedCacheConfig {
  url: string;
  password?: string;
  defaultTTL: number;
  enableLogging: boolean;
}

/**
 * Cache adapter using Redis
 */
export class CacheAdapter {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly config: ResolvedCacheConfig;

  constructor(config?: CacheConfig) {
    this.config = {
      url: config?.url || process.env.REDIS_URL || 'redis://localhost:6379',
      password: config?.password || process.env.REDIS_PASSWORD,
      defaultTTL: config?.defaultTTL || 30,
      enableLogging: config?.enableLogging !== false,
    };

    // Create Redis client
    this.client = createClient({
      url: this.config.url,
      password: this.config.password,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.log('error', 'Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          this.log('warn', `Reconnecting... (attempt ${retries + 1}, delay ${delay}ms)`);
          return delay;
        },
      },
    }) as RedisClientType;

    // Event listeners
    this.client.on('error', (err) => {
      this.log('error', `Redis error: ${err.message}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.log('info', '✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.log('info', '✅ Redis ready');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      this.log('warn', '🔄 Redis reconnecting...');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.isConnected && !this.client.isOpen) {
      try {
        await this.client.connect();
        this.log('info', '✅ Connected to Redis');
      } catch (error) {
        this.log('error', `Failed to connect to Redis: ${(error as Error).message}`);
        throw error;
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
      this.isConnected = false;
      this.log('info', 'Disconnected from Redis');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client.isOpen;
  }

  // ===== QUOTE CACHING =====

  /**
   * Generate cache key for quote
   */
  private getQuoteCacheKey(params: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    slippage: string;
  }): string {
    return `quote:${params.chainId}:${params.tokenIn}:${params.tokenOut}:${params.amount}:${params.slippage}`;
  }

  /**
   * Get cached quote
   */
  async getCachedQuote(params: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    slippage: string;
  }): Promise<SwapQuote | null> {
    if (!this.isAvailable()) {
      this.log('warn', 'Redis not available, skipping cache lookup');
      return null;
    }

    try {
      const key = this.getQuoteCacheKey(params);
      const cached = await this.client.get(key);

      if (cached) {
        this.log('debug', `✅ Cache hit: ${key}`);
        return JSON.parse(cached, this.reviveBigInt);
      }

      this.log('debug', `❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      this.log('error', `Error getting cached quote: ${(error as Error).message}`);
      return null; // Fail gracefully
    }
  }

  /**
   * Cache quote
   */
  async cacheQuote(
    params: {
      chainId: number;
      tokenIn: string;
      tokenOut: string;
      amount: string;
      slippage: string;
    },
    quote: SwapQuote,
    ttl?: number
  ): Promise<void> {
    if (!this.isAvailable()) {
      this.log('warn', 'Redis not available, skipping cache write');
      return;
    }

    try {
      const key = this.getQuoteCacheKey(params);
      const value = JSON.stringify(quote, this.replaceBigInt);
      const expiry = ttl || this.config.defaultTTL;

      await this.client.setEx(key, expiry, value);
      this.log('debug', `📝 Cached quote: ${key} (TTL: ${expiry}s)`);
    } catch (error) {
      this.log('error', `Error caching quote: ${(error as Error).message}`);
      // Fail gracefully
    }
  }

  // ===== APPROVAL CACHING =====

  /**
   * Generate cache key for approval
   */
  private getApprovalCacheKey(params: {
    chainId: number;
    token: string;
    wallet: string;
  }): string {
    return `approval:${params.chainId}:${params.token}:${params.wallet}`;
  }

  /**
   * Get cached approval status
   */
  async getCachedApproval(params: {
    chainId: number;
    token: string;
    wallet: string;
  }): Promise<{ needsApproval: boolean; currentAllowance: string } | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.getApprovalCacheKey(params);
      const cached = await this.client.get(key);

      if (cached) {
        this.log('debug', `✅ Approval cache hit: ${key}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      this.log('error', `Error getting cached approval: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Cache approval status
   */
  async cacheApproval(
    params: {
      chainId: number;
      token: string;
      wallet: string;
    },
    data: { needsApproval: boolean; currentAllowance: string },
    ttl: number = 300 // 5 minutes
  ): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const key = this.getApprovalCacheKey(params);
      await this.client.setEx(key, ttl, JSON.stringify(data));
      this.log('debug', `📝 Cached approval: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.log('error', `Error caching approval: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate approval cache (after user approves token)
   */
  async invalidateApproval(params: {
    chainId: number;
    token: string;
    wallet: string;
  }): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const key = this.getApprovalCacheKey(params);
      await this.client.del(key);
      this.log('debug', `🗑️  Invalidated approval: ${key}`);
    } catch (error) {
      this.log('error', `Error invalidating approval: ${(error as Error).message}`);
    }
  }

  // ===== GENERIC OPERATIONS =====

  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value, this.reviveBigInt) : null;
    } catch (error) {
      this.log('error', `Error getting key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set value with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value, this.replaceBigInt);

      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      this.log('debug', `📝 Set key: ${key}${ttl ? ` (TTL: ${ttl}s)` : ''}`);
    } catch (error) {
      this.log('error', `Error setting key ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Delete key
   */
  async delete(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client.del(key);
      this.log('debug', `🗑️  Deleted key: ${key}`);
    } catch (error) {
      this.log('error', `Error deleting key ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client.flushDb();
      this.log('warn', '🗑️  All cache cleared');
    } catch (error) {
      this.log('error', `Error clearing cache: ${(error as Error).message}`);
    }
  }

  // ===== PRIVATE HELPERS =====

  /**
   * BigInt serialization (JSON doesn't support BigInt)
   */
  private replaceBigInt(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return { __type: 'bigint', value: value.toString() };
    }
    return value;
  }

  /**
   * BigInt deserialization
   */
  private reviveBigInt(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'bigint') {
      return BigInt(value.value);
    }
    return value;
  }

  /**
   * Logging utility
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (!this.config.enableLogging) return;

    const prefix = '[CacheAdapter]';
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️  ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
    }
  }
}
