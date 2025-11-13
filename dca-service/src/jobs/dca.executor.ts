import cron from 'node-cron';
import { RedisClientType } from 'redis';
import { DCAService } from '../services/dca.service';
import { SmartAccountService } from '../services/smartAccount.service';
import { SwapService } from '../services/swap.service';
import { AuditLogger, AuditEventType } from '../services/auditLog.service';

/**
 * DCA Executor - Runs strategies on schedule
 * This job checks for pending DCA executions every minute
 */
export class DCAExecutor {
  private dcaService: DCAService;
  private smartAccountService: SmartAccountService;
  private swapService: SwapService;
  private auditLogger: AuditLogger;
  private job: cron.ScheduledTask | null = null;

  constructor(private redisClient: RedisClientType) {
    this.dcaService = new DCAService(redisClient);
    this.smartAccountService = new SmartAccountService(redisClient);
    this.swapService = new SwapService();
    this.auditLogger = AuditLogger.getInstance();
  }

  /**
   * Start the cron job
   */
  start() {
    console.log('[DCA Executor] Starting DCA execution cron job...');

    // Run every minute: '* * * * *'
    // For testing, you can use more frequent: '*/10 * * * * *' (every 10 seconds)
    this.job = cron.schedule('* * * * *', async () => {
      await this.executeReadyStrategies();
    });

    console.log('[DCA Executor] ✅ Cron job started (runs every minute)');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      console.log('[DCA Executor] Cron job stopped');
    }
  }

  /**
   * Execute all strategies that are ready
   */
  private async executeReadyStrategies() {
    try {
      console.log('[DCA Executor] Checking for pending executions...');

      // Get strategies ready for execution
      const strategyIds = await this.dcaService.getReadyStrategies();

      if (strategyIds.length === 0) {
        console.log('[DCA Executor] No strategies ready for execution');
        return;
      }

      console.log(`[DCA Executor] Found ${strategyIds.length} strategies to execute`);

      // Execute each strategy
      for (const strategyId of strategyIds) {
        try {
          await this.executeStrategy(strategyId);
        } catch (error: any) {
          console.error(`[DCA Executor] ❌ Error executing strategy ${strategyId}:`, error.message);

          // Log failure in history
          const strategy = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);
          if (strategy.smartAccountId) {
            await this.dcaService.addExecutionHistory(strategy.smartAccountId, {
              timestamp: Date.now(),
              txHash: '',
              amount: strategy.amount,
              fromToken: strategy.fromToken,
              toToken: strategy.toToken,
              status: 'failed',
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      console.error('[DCA Executor] Error in executeReadyStrategies:', error);
    }
  }

  /**
   * Execute a single DCA strategy
   */
  private async executeStrategy(strategyId: string) {
    console.log(`[DCA Executor] Executing strategy ${strategyId}...`);

    // 1. Get strategy data
    const strategyData = await this.redisClient.hGetAll(`dca-strategy:${strategyId}`);

    if (Object.keys(strategyData).length === 0) {
      console.log(`[DCA Executor] Strategy ${strategyId} not found, removing from schedule`);
      await this.redisClient.zRem('dca-scheduled', strategyId);
      return;
    }

    // Check if strategy is active
    if (strategyData.isActive !== 'true') {
      console.log(`[DCA Executor] Strategy ${strategyId} is inactive, skipping`);
      return;
    }

    const {
      smartAccountId,
      fromToken,
      toToken,
      fromChainId,
      toChainId,
      amount
    } = strategyData;

    // 2. Get encrypted session key
    const sessionKey = await this.smartAccountService.getSessionKey(smartAccountId);

    if (!sessionKey) {
      console.log(`[DCA Executor] Session key expired for ${smartAccountId}`);

      // Mark strategy as inactive
      await this.dcaService.toggleStrategy(strategyId, false);

      // Log failure
      await this.dcaService.addExecutionHistory(smartAccountId, {
        timestamp: Date.now(),
        txHash: '',
        amount,
        fromToken,
        toToken,
        status: 'failed',
        error: 'Session key expired'
      });

      return;
    }

    // Get smart account info for audit logging
    const account = await this.smartAccountService.getSmartAccount(smartAccountId);
    const userId = account?.userId || smartAccountId;

    // Audit log: DCA execution started
    await this.auditLogger.log({
      eventType: AuditEventType.STRATEGY_UPDATED,
      userId,
      metadata: {
        strategyId,
        smartAccountId,
        fromToken,
        toToken,
        amount,
        action: 'execution_started'
      },
    });

    // 3. Execute swap via SwapService (REAL implementation)
    console.log(`[DCA Executor] 🔄 Executing swap for strategy ${strategyId}...`);
    const swapResult = await this.swapService.executeSwap({
      smartAccountAddress: smartAccountId,
      sessionKey,
      fromToken,
      toToken,
      fromChainId: parseInt(fromChainId),
      toChainId: parseInt(toChainId),
      amount,
      userId,
    });

    // 4. Log execution in history
    await this.dcaService.addExecutionHistory(smartAccountId, {
      timestamp: Date.now(),
      txHash: swapResult.txHash,
      amount,
      fromToken,
      toToken,
      status: 'success'
    });

    // 5. Update strategy for next execution
    await this.dcaService.updateStrategyAfterExecution(strategyId);

    console.log(`[DCA Executor] ✅ Strategy ${strategyId} executed successfully. TX: ${swapResult.txHash}`);

    // Audit log: DCA execution success
    await this.auditLogger.log({
      eventType: AuditEventType.SWAP_SUCCESS,
      userId,
      metadata: {
        strategyId,
        smartAccountId,
        txHash: swapResult.txHash,
        fromToken,
        toToken,
        amountIn: swapResult.amountIn,
        amountOut: swapResult.amountOut,
      },
    });
  }
}

/**
 * Initialize and start DCA executor
 */
export function startDCAExecutor(redisClient: RedisClientType): DCAExecutor {
  const executor = new DCAExecutor(redisClient);
  executor.start();
  return executor;
}
