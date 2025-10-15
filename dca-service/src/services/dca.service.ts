import { RedisClientType } from 'redis';
import { DCAStrategy, CreateStrategyRequest, ExecutionHistory } from '../types';

export class DCAService {
  constructor(private redisClient: RedisClientType) {}

  /**
   * Create a new DCA strategy
   */
  async createStrategy(request: CreateStrategyRequest): Promise<{
    strategyId: string;
    nextExecution: Date;
  }> {
    console.log('[DCAService] Creating strategy for account:', request.smartAccountId);

    // 1. Verify smart account exists
    const exists = await this.redisClient.exists(`smart-account:${request.smartAccountId}`);
    if (!exists) {
      throw new Error('Smart account not found');
    }

    // 2. Calculate next execution time
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = this.getIntervalSeconds(request.interval);
    const nextExecution = now + intervalSeconds;

    // 3. Generate strategy ID
    const strategyId = `${request.smartAccountId}-${Date.now()}`;

    // 4. Create strategy data
    const strategy: DCAStrategy = {
      smartAccountId: request.smartAccountId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      amount: request.amount,
      interval: request.interval,
      lastExecuted: 0,
      nextExecution,
      isActive: true
    };

    // 5. Save to Redis
    const multi = this.redisClient.multi();

    // Store strategy
    multi.hSet(`dca-strategy:${strategyId}`, {
      smartAccountId: strategy.smartAccountId,
      fromToken: strategy.fromToken,
      toToken: strategy.toToken,
      fromChainId: strategy.fromChainId.toString(),
      toChainId: strategy.toChainId.toString(),
      amount: strategy.amount,
      interval: strategy.interval,
      lastExecuted: strategy.lastExecuted.toString(),
      nextExecution: strategy.nextExecution.toString(),
      isActive: strategy.isActive.toString()
    });

    // Add to scheduled sorted set
    multi.zAdd('dca-scheduled', {
      score: nextExecution,
      value: strategyId
    });

    // Add to account's strategies index
    multi.sAdd(`account:strategies:${request.smartAccountId}`, strategyId);

    await multi.exec();

    console.log('[DCAService] ✅ Strategy created:', strategyId);

    return {
      strategyId,
      nextExecution: new Date(nextExecution * 1000)
    };
  }

  /**
   * Get all strategies for a smart account
   */
  async getAccountStrategies(smartAccountId: string): Promise<DCAStrategy[]> {
    const strategyIds = await this.redisClient.sMembers(`account:strategies:${smartAccountId}`);

    if (strategyIds.length === 0) {
      return [];
    }

    const strategies: DCAStrategy[] = [];

    for (const strategyId of strategyIds) {
      const data = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);

      if (Object.keys(data).length === 0) {
        // Strategy not found, remove from index
        await this.redisClient.sRem(`account:strategies:${smartAccountId}`, strategyId);
        continue;
      }

      strategies.push({
        smartAccountId: data.smartAccountId,
        fromToken: data.fromToken,
        toToken: data.toToken,
        fromChainId: parseInt(data.fromChainId),
        toChainId: parseInt(data.toChainId),
        amount: data.amount,
        interval: data.interval as 'daily' | 'weekly' | 'monthly',
        lastExecuted: parseInt(data.lastExecuted),
        nextExecution: parseInt(data.nextExecution),
        isActive: data.isActive === 'true'
      });
    }

    return strategies;
  }

  /**
   * Update strategy active status
   */
  async toggleStrategy(strategyId: string, isActive: boolean): Promise<void> {
    const exists = await this.redisClient.exists(`dca-strategy:${strategyId}`);
    if (!exists) {
      throw new Error('Strategy not found');
    }

    await this.redisClient.hSet(`dca-strategy:${strategyId}`, {
      isActive: isActive.toString()
    });

    if (!isActive) {
      // Remove from scheduled if deactivated
      await this.redisClient.zRem('dca-scheduled', strategyId);
    } else {
      // Re-add to scheduled if activated
      const strategy = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);
      await this.redisClient.zAdd('dca-scheduled', {
        score: parseInt(strategy.nextExecution),
        value: strategyId
      });
    }

    console.log(`[DCAService] Strategy ${strategyId} ${isActive ? 'activated' : 'deactivated'}`);
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string): Promise<void> {
    const strategy = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);

    if (Object.keys(strategy).length === 0) {
      throw new Error('Strategy not found');
    }

    const multi = this.redisClient.multi();

    // Remove strategy data
    multi.del(`dca-strategy:${strategyId}`);

    // Remove from scheduled
    multi.zRem('dca-scheduled', strategyId);

    // Remove from account index
    multi.sRem(`account:strategies:${strategy.smartAccountId}`, strategyId);

    await multi.exec();

    console.log('[DCAService] ✅ Strategy deleted:', strategyId);
  }

  /**
   * Get execution history for a smart account
   */
  async getExecutionHistory(smartAccountId: string, limit: number = 100): Promise<ExecutionHistory[]> {
    const historyJson = await this.redisClient.lRange(`dca-history:${smartAccountId}`, 0, limit - 1);

    return historyJson.map(json => JSON.parse(json));
  }

  /**
   * Add execution to history
   */
  async addExecutionHistory(smartAccountId: string, execution: ExecutionHistory): Promise<void> {
    await this.redisClient.lPush(`dca-history:${smartAccountId}`, JSON.stringify(execution));

    // Keep only last 100 records
    await this.redisClient.lTrim(`dca-history:${smartAccountId}`, 0, 99);
  }

  /**
   * Get strategies ready for execution
   */
  async getReadyStrategies(): Promise<string[]> {
    const now = Math.floor(Date.now() / 1000);

    // Get all strategies with score (nextExecution) <= now
    return await this.redisClient.zRangeByScore('dca-scheduled', 0, now);
  }

  /**
   * Update strategy after execution
   */
  async updateStrategyAfterExecution(strategyId: string): Promise<void> {
    const strategy = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);

    if (Object.keys(strategy).length === 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = this.getIntervalSeconds(strategy.interval as any);
    const nextExecution = now + intervalSeconds;

    const multi = this.redisClient.multi();

    // Update strategy
    multi.hSet(`dca-strategy:${strategyId}`, {
      lastExecuted: now.toString(),
      nextExecution: nextExecution.toString()
    });

    // Update scheduled time
    multi.zAdd('dca-scheduled', {
      score: nextExecution,
      value: strategyId
    });

    await multi.exec();

    console.log(`[DCAService] Strategy ${strategyId} rescheduled for ${new Date(nextExecution * 1000)}`);
  }

  /**
   * Get interval in seconds
   */
  private getIntervalSeconds(interval: 'daily' | 'weekly' | 'monthly'): number {
    const intervals = {
      daily: 86400,      // 24 hours
      weekly: 604800,    // 7 days
      monthly: 2592000   // 30 days
    };

    return intervals[interval];
  }
}
