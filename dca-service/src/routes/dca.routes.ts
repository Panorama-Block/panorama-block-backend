import { Router, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { SmartAccountService } from '../services/smartAccount.service';
import { DCAService } from '../services/dca.service';
import { CreateSmartAccountRequest, CreateStrategyRequest } from '../types';

export function dcaRoutes(redisClient: RedisClientType) {
  const router = Router();
  const smartAccountService = new SmartAccountService(redisClient);
  const dcaService = new DCAService(redisClient);

  // ==================== SMART ACCOUNTS ====================

  /**
   * POST /dca/create-account
   * Create a new smart account with session keys
   */
  router.post('/create-account', async (req: Request, res: Response) => {
    try {
      console.log('[POST /create-account] Request received');

      const request: CreateSmartAccountRequest = req.body;

      if (!request.userId || !request.name || !request.permissions) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await smartAccountService.createSmartAccount(request);

      console.log('[POST /create-account] ✅ Account created successfully');
      res.json(result);
    } catch (error: any) {
      console.error('[POST /create-account] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/accounts/:userId
   * Get all smart accounts for a user
   */
  router.get('/accounts/:userId', async (req: Request, res: Response) => {
    try {
      console.log('[GET /accounts/:userId] Request for user:', req.params.userId);

      const accounts = await smartAccountService.getUserAccounts(req.params.userId);

      // Log para debug
      console.log('[GET /accounts/:userId] Returning accounts:', JSON.stringify(accounts, null, 2));

      res.json({ accounts });
    } catch (error: any) {
      console.error('[GET /accounts/:userId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/account/:address
   * Get single smart account details
   */
  router.get('/account/:address', async (req: Request, res: Response) => {
    try {
      const account = await smartAccountService.getSmartAccount(req.params.address);

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json(account);
    } catch (error: any) {
      console.error('[GET /account/:address] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /dca/account/:address
   * Delete a smart account
   */
  router.delete('/account/:address', async (req: Request, res: Response) => {
    try {
      console.log('[DELETE /account/:address] Deleting account:', req.params.address);

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      await smartAccountService.deleteSmartAccount(req.params.address, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE /account/:address] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DCA STRATEGIES ====================

  /**
   * POST /dca/create-strategy
   * Create a new DCA strategy
   */
  router.post('/create-strategy', async (req: Request, res: Response) => {
    try {
      console.log('[POST /create-strategy] Request received');

      const request: CreateStrategyRequest = req.body;

      if (!request.smartAccountId || !request.fromToken || !request.toToken || !request.amount || !request.interval) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await dcaService.createStrategy(request);

      console.log('[POST /create-strategy] ✅ Strategy created successfully');
      res.json(result);
    } catch (error: any) {
      console.error('[POST /create-strategy] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/strategies/:smartAccountId
   * Get all strategies for a smart account
   */
  router.get('/strategies/:smartAccountId', async (req: Request, res: Response) => {
    try {
      const strategies = await dcaService.getAccountStrategies(req.params.smartAccountId);

      res.json({ strategies });
    } catch (error: any) {
      console.error('[GET /strategies/:smartAccountId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /dca/strategy/:strategyId/toggle
   * Activate or deactivate a strategy
   */
  router.patch('/strategy/:strategyId/toggle', async (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      await dcaService.toggleStrategy(req.params.strategyId, isActive);

      res.json({ success: true, isActive });
    } catch (error: any) {
      console.error('[PATCH /strategy/:strategyId/toggle] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /dca/strategy/:strategyId
   * Delete a strategy
   */
  router.delete('/strategy/:strategyId', async (req: Request, res: Response) => {
    try {
      await dcaService.deleteStrategy(req.params.strategyId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE /strategy/:strategyId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/history/:smartAccountId
   * Get execution history for a smart account
   */
  router.get('/history/:smartAccountId', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await dcaService.getExecutionHistory(req.params.smartAccountId, limit);

      res.json({ history });
    } catch (error: any) {
      console.error('[GET /history/:smartAccountId] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DEBUG/ADMIN ROUTES ====================

  /**
   * GET /dca/debug/all-accounts
   * Get ALL smart accounts in Redis
   */
  router.get('/debug/all-accounts', async (_req: Request, res: Response) => {
    try {
      console.log('[GET /debug/all-accounts] Fetching all smart accounts from Redis...');

      // Get all keys matching smart-account:*
      const accountKeys = await redisClient.keys('smart-account:*');

      const accounts = [];
      for (const key of accountKeys) {
        const accountData = await redisClient.hGetAll(key);
        if (Object.keys(accountData).length > 0) {
          accounts.push({
            key,
            address: key.replace('smart-account:', ''),
            ...accountData,
            permissions: accountData.permissions ? JSON.parse(accountData.permissions) : null,
            createdAt: accountData.createdAt ? parseInt(accountData.createdAt) : null,
            expiresAt: accountData.expiresAt ? parseInt(accountData.expiresAt) : null,
          });
        }
      }

      res.json({
        total: accounts.length,
        accounts,
      });
    } catch (error: any) {
      console.error('[GET /debug/all-accounts] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/debug/all-strategies
   * Get ALL DCA strategies in Redis
   */
  router.get('/debug/all-strategies', async (_req: Request, res: Response) => {
    try {
      console.log('[GET /debug/all-strategies] Fetching all strategies from Redis...');

      // Get all keys matching dca-strategy:*
      const strategyKeys = await redisClient.keys('dca-strategy:*');

      const strategies = [];
      for (const key of strategyKeys) {
        const strategyData = await redisClient.hGetAll(key);
        if (Object.keys(strategyData).length > 0) {
          strategies.push({
            key,
            strategyId: key.replace('dca-strategy:', ''),
            ...strategyData,
            fromChainId: parseInt(strategyData.fromChainId),
            toChainId: parseInt(strategyData.toChainId),
            lastExecuted: parseInt(strategyData.lastExecuted),
            nextExecution: parseInt(strategyData.nextExecution),
            nextExecutionDate: new Date(parseInt(strategyData.nextExecution) * 1000).toISOString(),
            isActive: strategyData.isActive === 'true',
          });
        }
      }

      res.json({
        total: strategies.length,
        strategies,
      });
    } catch (error: any) {
      console.error('[GET /debug/all-strategies] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/debug/scheduled
   * Get all scheduled strategies (sorted set)
   */
  router.get('/debug/scheduled', async (_req: Request, res: Response) => {
    try {
      console.log('[GET /debug/scheduled] Fetching scheduled strategies...');

      // Get all scheduled strategies with scores
      const scheduled = await redisClient.zRangeWithScores('dca-scheduled', 0, -1);

      const scheduledStrategies = scheduled.map((item) => ({
        strategyId: item.value,
        nextExecution: item.score,
        nextExecutionDate: new Date(item.score * 1000).toISOString(),
        isReady: item.score <= Math.floor(Date.now() / 1000),
      }));

      const now = Math.floor(Date.now() / 1000);
      const readyStrategies = scheduledStrategies.filter(s => s.isReady);

      res.json({
        total: scheduledStrategies.length,
        ready: readyStrategies.length,
        currentTimestamp: now,
        currentTime: new Date(now * 1000).toISOString(),
        scheduled: scheduledStrategies,
      });
    } catch (error: any) {
      console.error('[GET /debug/scheduled] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/debug/all-history
   * Get ALL execution history from all accounts
   */
  router.get('/debug/all-history', async (_req: Request, res: Response) => {
    try {
      console.log('[GET /debug/all-history] Fetching all execution history...');

      // Get all keys matching dca-history:*
      const historyKeys = await redisClient.keys('dca-history:*');

      const allHistory: any[] = [];
      for (const key of historyKeys) {
        const smartAccountId = key.replace('dca-history:', '');
        const historyJson = await redisClient.lRange(key, 0, -1);

        const accountHistory = historyJson.map(json => ({
          smartAccountId,
          ...JSON.parse(json),
        }));

        allHistory.push(...accountHistory);
      }

      // Sort by timestamp descending
      allHistory.sort((a, b) => b.timestamp - a.timestamp);

      res.json({
        total: allHistory.length,
        history: allHistory,
      });
    } catch (error: any) {
      console.error('[GET /debug/all-history] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /dca/debug/redis-stats
   * Get Redis database statistics
   */
  router.get('/debug/redis-stats', async (_req: Request, res: Response) => {
    try {
      console.log('[GET /debug/redis-stats] Fetching Redis stats...');

      const [
        accountKeys,
        strategyKeys,
        historyKeys,
        scheduledCount,
      ] = await Promise.all([
        redisClient.keys('smart-account:*'),
        redisClient.keys('dca-strategy:*'),
        redisClient.keys('dca-history:*'),
        redisClient.zCard('dca-scheduled'),
      ]);

      res.json({
        stats: {
          smartAccounts: accountKeys.length,
          strategies: strategyKeys.length,
          historyLists: historyKeys.length,
          scheduledStrategies: scheduledCount,
        },
        keys: {
          accountKeys: accountKeys.slice(0, 10), // Sample
          strategyKeys: strategyKeys.slice(0, 10), // Sample
          historyKeys: historyKeys.slice(0, 10), // Sample
        },
      });
    } catch (error: any) {
      console.error('[GET /debug/redis-stats] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /dca/debug/execute/:strategyId
   * Manually execute a DCA strategy (for testing)
   */
  router.post('/debug/execute/:strategyId', async (req: Request, res: Response) => {
    try {
      const { strategyId } = req.params;
      console.log(`\n[POST /debug/execute] 🚀 Manually executing strategy: ${strategyId}`);

      // 1. Get strategy data
      const strategyData = await redisClient.hGetAll(`dca-strategy:${strategyId}`);

      if (Object.keys(strategyData).length === 0) {
        return res.status(404).json({
          error: 'Strategy not found',
          strategyId
        });
      }

      // 2. Check if strategy is active
      if (strategyData.isActive !== 'true') {
        return res.status(400).json({
          error: 'Strategy is inactive',
          strategyId,
          status: strategyData.isActive
        });
      }

      const {
        smartAccountId,
        fromToken,
        toToken,
        fromChainId,
        toChainId,
        amount,
        interval
      } = strategyData;

      console.log(`[POST /debug/execute] Strategy details:`, {
        smartAccountId,
        fromToken,
        toToken,
        fromChainId,
        toChainId,
        amount,
        interval
      });

      // 3. Get encrypted session key
      const sessionKey = await smartAccountService.getSessionKey(smartAccountId);

      if (!sessionKey) {
        console.log(`[POST /debug/execute] ❌ Session key expired for ${smartAccountId}`);

        // Mark strategy as inactive
        await dcaService.toggleStrategy(strategyId, false);

        // Log failure
        await dcaService.addExecutionHistory(smartAccountId, {
          timestamp: Date.now(),
          txHash: '',
          amount,
          fromToken,
          toToken,
          status: 'failed',
          error: 'Session key expired'
        });

        return res.status(400).json({
          error: 'Session key expired',
          message: 'Strategy has been deactivated',
          strategyId
        });
      }

      console.log(`[POST /debug/execute] ✅ Session key found for ${smartAccountId}`);

      // 4. Execute swap via liquid-swap-service or thirdweb engine
      console.log(`[POST /debug/execute] 🔄 Executing swap...`);

      const swapResult = await executeSwap({
        smartAccountAddress: smartAccountId,
        sessionKey,
        fromToken,
        toToken,
        fromChainId: parseInt(fromChainId),
        toChainId: parseInt(toChainId),
        amount
      });

      console.log(`[POST /debug/execute] ✅ Swap executed successfully. TX: ${swapResult.txHash}`);

      // 5. Log execution in history
      await dcaService.addExecutionHistory(smartAccountId, {
        timestamp: Date.now(),
        txHash: swapResult.txHash,
        amount,
        fromToken,
        toToken,
        status: 'success'
      });

      // 6. Update strategy for next execution
      await dcaService.updateStrategyAfterExecution(strategyId);

      // 7. Get updated strategy data
      const updatedStrategy = await redisClient.hGetAll(`dca-strategy:${strategyId}`);

      res.json({
        success: true,
        message: 'Strategy executed successfully',
        execution: {
          strategyId,
          txHash: swapResult.txHash,
          timestamp: Date.now(),
          amount,
          fromToken,
          toToken,
          fromChainId: parseInt(fromChainId),
          toChainId: parseInt(toChainId),
        },
        nextExecution: {
          timestamp: parseInt(updatedStrategy.nextExecution),
          date: new Date(parseInt(updatedStrategy.nextExecution) * 1000).toISOString(),
        }
      });
    } catch (error: any) {
      console.error('[POST /debug/execute] ❌ Error:', error);
      res.status(500).json({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * Execute swap using Thirdweb SDK directly
   */
  async function executeSwap(params: {
    smartAccountAddress: string;
    sessionKey: string;
    fromToken: string;
    toToken: string;
    fromChainId: number;
    toChainId: number;
    amount: string;
  }): Promise<{ txHash: string }> {
    console.log('[executeSwap] 🔄 Preparing swap transaction...');
    console.log('[executeSwap] From:', params.fromToken);
    console.log('[executeSwap] To:', params.toToken);
    console.log('[executeSwap] Amount:', params.amount);
    console.log('[executeSwap] Chain:', params.fromChainId);

    try {
      // Import Thirdweb functions
      const { createThirdwebClient, getContract } = await import('thirdweb');
      const { defineChain } = await import('thirdweb/chains');
      const { privateKeyToAccount, smartWallet } = await import('thirdweb/wallets');
      const { prepareContractCall, sendTransaction, toWei } = await import('thirdweb');
      const { approve, allowance: getAllowance } = await import('thirdweb/extensions/erc20');

      // 1. Initialize Thirdweb client
      const client = createThirdwebClient({
        secretKey: process.env.THIRDWEB_SECRET_KEY!,
      });

      const chain = defineChain(params.fromChainId);

      console.log('[executeSwap] ✅ Thirdweb client initialized');

      // 2. Create personal account from session key
      const personalAccount = privateKeyToAccount({
        client,
        privateKey: params.sessionKey,
      });

      // 3. Connect to smart wallet
      // Smart Account will pay gas from its own balance
      const wallet = smartWallet({
        chain,
        gasless: false, // Smart Account pays gas from its own ETH balance
        // Using Thirdweb's default bundler (included with secretKey)
        // No custom bundler override needed
      });

      const smartAccount = await wallet.connect({
        client,
        personalAccount,
      });

      console.log('[executeSwap] ✅ Connected to smart account:', smartAccount.address);
      console.log('[executeSwap] 💰 Smart wallet will pay gas from its own balance');

      // 4. Check if we need to swap native ETH or ERC20 token
      const isNativeToken = params.fromToken === '0x0000000000000000000000000000000000000000' ||
                           params.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      if (isNativeToken) {
        // Native ETH swap - use Uniswap Router directly
        console.log('[executeSwap] 💎 Swapping native ETH');

        // Uniswap V3 SwapRouter address on Ethereum mainnet
        const SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

        // WETH address on Ethereum mainnet (Uniswap V3 requires WETH, not 0x00...00)
        const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

        const swapRouterContract = getContract({
          client,
          chain,
          address: SWAP_ROUTER_ADDRESS,
        });

        // Prepare exactInputSingle call
        // This is a simplified version - in production you'd want to:
        // 1. Get best route from a DEX aggregator
        // 2. Calculate slippage
        // 3. Set deadline
        const amountInWei = toWei(params.amount);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

        // exactInputSingle parameters
        const swapParams = {
          tokenIn: WETH_ADDRESS, // ✅ Use WETH instead of 0x00...00 for Uniswap V3
          tokenOut: params.toToken,
          fee: 3000, // 0.3% fee tier
          recipient: smartAccount.address,
          deadline: BigInt(deadline),
          amountIn: BigInt(amountInWei),
          amountOutMinimum: BigInt(0), // In production, calculate with slippage
          sqrtPriceLimitX96: BigInt(0),
        };

        console.log('[executeSwap] 📋 Swap params:', {
          tokenIn: swapParams.tokenIn,
          tokenOut: swapParams.tokenOut,
          fee: swapParams.fee,
          recipient: swapParams.recipient,
          deadline: swapParams.deadline.toString(),
          amountIn: swapParams.amountIn.toString(),
          amountInEth: params.amount,
          amountOutMinimum: swapParams.amountOutMinimum.toString(),
          value: amountInWei.toString(),
        });

        const transaction = prepareContractCall({
          contract: swapRouterContract,
          method: 'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256)',
          params: [swapParams],
          value: BigInt(amountInWei),
        });

        console.log('[executeSwap] 📝 Swap transaction prepared');

        // Execute the swap
        const result = await sendTransaction({
          transaction,
          account: smartAccount,
        });

        console.log('[executeSwap] ✅ Swap executed successfully!');
        console.log('[executeSwap] TX Hash:', result.transactionHash);

        return {
          txHash: result.transactionHash,
        };

      } else {
        // ERC20 token swap
        console.log('[executeSwap] 🪙 Swapping ERC20 token');

        const SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

        // First check and approve if needed
        const tokenContract = getContract({
          client,
          chain,
          address: params.fromToken,
        });

        const allowance = await getAllowance({
          contract: tokenContract,
          owner: smartAccount.address,
          spender: SWAP_ROUTER_ADDRESS,
        });

        const amountInWei = BigInt(toWei(params.amount));

        if (allowance < amountInWei) {
          console.log('[executeSwap] 📝 Approving token spend...');

          const approveTransaction = approve({
            contract: tokenContract,
            spender: SWAP_ROUTER_ADDRESS,
            amountWei: amountInWei,
          });

          await sendTransaction({
            transaction: approveTransaction,
            account: smartAccount,
          });

          console.log('[executeSwap] ✅ Token approved');
        }

        // Now execute the swap
        const swapRouterContract = getContract({
          client,
          chain,
          address: SWAP_ROUTER_ADDRESS,
        });

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

        const swapParams = {
          tokenIn: params.fromToken,
          tokenOut: params.toToken,
          fee: 3000,
          recipient: smartAccount.address,
          deadline: BigInt(deadline),
          amountIn: amountInWei,
          amountOutMinimum: BigInt(0),
          sqrtPriceLimitX96: BigInt(0),
        };

        const transaction = prepareContractCall({
          contract: swapRouterContract,
          method: 'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256)',
          params: [swapParams],
        });

        console.log('[executeSwap] 📝 Swap transaction prepared');

        const result = await sendTransaction({
          transaction,
          account: smartAccount,
        });

        console.log('[executeSwap] ✅ Swap executed successfully!');
        console.log('[executeSwap] TX Hash:', result.transactionHash);

        return {
          txHash: result.transactionHash,
        };
      }
    } catch (error: any) {
      console.error('[executeSwap] ❌ Swap failed:', error);
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  return router;
}
