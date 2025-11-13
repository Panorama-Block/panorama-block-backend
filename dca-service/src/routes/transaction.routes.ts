/**
 * Transaction Routes
 * Secure endpoints for signing transactions with session keys
 */

import { Router, Response } from 'express';
import { RedisClientType } from 'redis';
import { TransactionService } from '../services/transaction.service';
import { SmartAccountService } from '../services/smartAccount.service';
import { AuthenticatedRequest, verifyTelegramAuth, devBypassAuth } from '../middleware/auth.middleware';
import { transactionLimiter, generalLimiter } from '../middleware/rateLimit.middleware';

export function createTransactionRoutes(redisClient: RedisClientType): Router {
  const router = Router();
  const smartAccountService = new SmartAccountService(redisClient);
  const transactionService = new TransactionService(
    redisClient,
    smartAccountService
  );

  /**
   * POST /transaction/sign-and-execute
   * Sign and execute a transaction using session key (SECURE!)
   * 🔒 PROTECTED: Requires Telegram authentication + rate limiting
   *
   * Body:
   * {
   *   "smartAccountAddress": "0x...",
   *   "userId": "0x...",
   *   "to": "0x...",
   *   "value": "0.01",
   *   "chainId": 1
   * }
   */
  router.post('/sign-and-execute',
    transactionLimiter, // Rate limit: 20 per 5 minutes
    devBypassAuth,
    verifyTelegramAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    console.log('[POST /transaction/sign-and-execute] Request received');

    try {
      const { smartAccountAddress, userId, to, value, chainId, data } =
        req.body;

      // Validate required fields
      if (!smartAccountAddress || !userId || !to || !value || !chainId) {
        return res.status(400).json({
          error:
            'Missing required fields: smartAccountAddress, userId, to, value, chainId',
        });
      }

      // 🔒 SECURITY: Verify ownership
      if (req.user && req.user.id !== userId) {
        console.warn(`[POST /transaction/sign-and-execute] User ${req.user.id} tried to sign transaction for ${userId}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only sign transactions for your own accounts'
        });
      }

      // Execute transaction (private key NEVER leaves backend!)
      const result = await transactionService.signAndExecuteTransaction({
        smartAccountAddress,
        userId,
        to,
        value,
        chainId,
        data,
      });

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Transaction failed',
        });
      }

      res.json({
        transactionHash: result.transactionHash,
        success: true,
      });
    } catch (error: any) {
      console.error('[POST /transaction/sign-and-execute] Error:', error);
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  });

  /**
   * POST /transaction/withdraw-token
   * Withdraw ERC20 tokens from smart account
   * 🔒 PROTECTED: Requires Telegram authentication + rate limiting
   *
   * Body:
   * {
   *   "smartAccountAddress": "0x...",
   *   "userId": "0x...",
   *   "tokenAddress": "0x...",
   *   "amount": "100.5",
   *   "decimals": 18,
   *   "chainId": 1
   * }
   */
  router.post('/withdraw-token',
    transactionLimiter, // Rate limit: 20 per 5 minutes
    devBypassAuth,
    verifyTelegramAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    console.log('[POST /transaction/withdraw-token] ERC20 withdrawal request');

    try {
      const { smartAccountAddress, userId, tokenAddress, amount, decimals = 18, chainId } = req.body;

      // Validate required fields
      if (!smartAccountAddress || !userId || !tokenAddress || !amount || !chainId) {
        return res.status(400).json({
          error: 'Missing required fields: smartAccountAddress, userId, tokenAddress, amount, chainId',
        });
      }

      // 🔒 SECURITY: Verify ownership
      if (req.user && req.user.id !== userId) {
        console.warn(`[POST /transaction/withdraw-token] User ${req.user.id} tried to withdraw from ${userId}'s account`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only withdraw from your own accounts'
        });
      }

      // Import Thirdweb functions
      const { createThirdwebClient, getContract, prepareContractCall, sendTransaction } = await import('thirdweb');
      const { defineChain } = await import('thirdweb/chains');
      const { privateKeyToAccount, smartWallet } = await import('thirdweb/wallets');

      // 1. Initialize client
      const client = createThirdwebClient({
        secretKey: process.env.THIRDWEB_SECRET_KEY!,
      });

      // 2. Get session key from Redis
      const sessionKeyPrivateKey = await smartAccountService.getSessionKey(smartAccountAddress);
      if (!sessionKeyPrivateKey) {
        return res.status(404).json({ error: 'Session key not found for this smart account' });
      }

      // 3. Create personal account from session key
      const personalAccount = privateKeyToAccount({
        client,
        privateKey: sessionKeyPrivateKey,
      });

      // 4. Connect to smart wallet
      const chain = defineChain(chainId);
      const wallet = smartWallet({
        chain,
        gasless: false, // Smart Account pays gas from its own balance
        sponsorGas: false, // Disable Thirdweb paymaster (no billing charges!)
      });

      const smartAccount = await wallet.connect({
        client,
        personalAccount,
      });

      console.log('[withdraw-token] ✅ Connected to smart account:', smartAccount.address);

      // 5. Prepare ERC20 transfer
      const tokenContract = getContract({
        client,
        chain,
        address: tokenAddress,
      });

      // Convert amount to token units based on decimals
      // Example: 100.5 USDC (6 decimals) = 100500000
      //          1.5 UNI (18 decimals) = 1500000000000000000
      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

      // Prepare ERC20 transfer call: transfer(address to, uint256 amount)
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: 'function transfer(address to, uint256 amount) returns (bool)',
        params: [userId, amountInUnits],
      });

      console.log('[withdraw-token] 📝 Transfer prepared:', {
        token: tokenAddress,
        to: userId,
        amount: amount,
        decimals: decimals,
        amountInUnits: amountInUnits.toString(),
      });

      // 6. Execute transaction
      const result = await sendTransaction({
        transaction,
        account: smartAccount,
      });

      console.log('[withdraw-token] ✅ Token withdrawal successful!');
      console.log('[withdraw-token] TX Hash:', result.transactionHash);

      res.json({
        transactionHash: result.transactionHash,
        success: true,
      });
    } catch (error: any) {
      console.error('[POST /transaction/withdraw-token] Error:', error);
      res.status(500).json({
        error: error.message || 'Token withdrawal failed',
      });
    }
  });

  /**
   * POST /transaction/validate
   * Validate if a transaction would be allowed by session key permissions
   * 🔒 PROTECTED: Requires Telegram authentication
   *
   * Body:
   * {
   *   "smartAccountAddress": "0x...",
   *   "to": "0x...",
   *   "value": "0.01"
   * }
   */
  router.post('/validate',
    generalLimiter,
    devBypassAuth,
    verifyTelegramAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    console.log('[POST /transaction/validate] Validating permissions');

    try {
      const { smartAccountAddress, to, value } = req.body;

      if (!smartAccountAddress || !to || !value) {
        return res.status(400).json({
          error: 'Missing required fields: smartAccountAddress, to, value',
        });
      }

      const validation = await transactionService.validateSessionPermissions(
        smartAccountAddress,
        to,
        value
      );

      res.json(validation);
    } catch (error: any) {
      console.error('[POST /transaction/validate] Error:', error);
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  });

  return router;
}
