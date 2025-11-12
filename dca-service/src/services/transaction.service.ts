/**
 * Transaction Service
 * Handles secure transaction signing with session keys using Account Abstraction
 * SECURITY: Private keys never leave the backend
 */

import { RedisClientType } from 'redis';
import { SmartAccountService } from './smartAccount.service';
import { createThirdwebClient, prepareTransaction, type Address, type Hex } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { privateKeyToAccount, smartWallet } from 'thirdweb/wallets';
import { sendTransaction, toWei } from 'thirdweb';

export interface PrepareTransactionRequest {
  smartAccountAddress: string;
  userId: string; // For authorization
  to: string;
  value: string; // Amount in ETH (will be converted to wei)
  chainId: number;
  data?: string; // Optional contract call data
}

export interface SignedTransactionResponse {
  transactionHash: string;
  success: boolean;
  error?: string;
}

export class TransactionService {
  private client: any;

  constructor(
    private redisClient: RedisClientType,
    private smartAccountService: SmartAccountService
  ) {
    // Validate environment variable
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error('THIRDWEB_SECRET_KEY is required in .env file!');
    }

    // Initialize Thirdweb client with secret key (backend only!)
    this.client = createThirdwebClient({
      secretKey: secretKey,
    });
  }

  /**
   * Sign and execute a transaction using session key via Smart Account
   * SECURITY: This is the ONLY way to use session keys - they never leave backend
   * The transaction is sent FROM the smart account, signed BY the session key
   */
  async signAndExecuteTransaction(
    request: PrepareTransactionRequest
  ): Promise<SignedTransactionResponse> {
    console.log('[TransactionService] 🔐 Signing transaction via Smart Account...');
    console.log('[TransactionService] Smart Account:', request.smartAccountAddress);
    console.log('[TransactionService] To:', request.to);
    console.log('[TransactionService] Value:', request.value, 'ETH');

    try {
      // 1. SECURITY: Verify user owns this smart account
      const account = await this.smartAccountService.getSmartAccount(
        request.smartAccountAddress
      );

      if (!account) {
        throw new Error('Smart account not found');
      }

      if (account.userId !== request.userId) {
        console.error('[TransactionService] ❌ Authorization failed!');
        console.error(`Account owner: ${account.userId}, Requester: ${request.userId}`);
        throw new Error('Unauthorized: You do not own this smart account');
      }

      // 2. SECURITY: Check if session key is still valid
      const now = Date.now();
      if (now > account.expiresAt) {
        throw new Error('Session key has expired');
      }

      // 3. SECURITY: Validate transaction parameters
      await this.validateTransaction(request, account);

      // 4. Get decrypted session key (STAYS IN BACKEND!)
      const sessionKeyPrivate = await this.smartAccountService.getSessionKey(
        request.smartAccountAddress
      );

      if (!sessionKeyPrivate) {
        throw new Error('Session key not found');
      }

      console.log('[TransactionService] 🔑 Session key retrieved (encrypted in storage)');

      // 5. Create personal account from session key (IN BACKEND ONLY!)
      const personalAccount = privateKeyToAccount({
        client: this.client,
        privateKey: sessionKeyPrivate,
      });

      console.log('[TransactionService] ✅ Personal account created from session key');
      console.log('[TransactionService] Personal account address:', personalAccount.address);

      // 6. Connect to the smart wallet using the session key as signer
      const chain = defineChain(request.chainId);
      const wallet = smartWallet({
        chain,
        gasless: false, // Set to true if using sponsored transactions
      });

      // Connect with the session key - this gives us control of the smart account
      const smartAccount = await wallet.connect({
        client: this.client,
        personalAccount,
      });

      console.log('[TransactionService] ✅ Connected to Smart Account:', smartAccount.address);

      // 7. Prepare transaction FROM the smart account
      const transaction = prepareTransaction({
        to: request.to as Address,
        value: toWei(request.value),
        chain,
        client: this.client,
        data: (request.data as Hex | undefined) ?? undefined,
      });

      console.log('[TransactionService] 📝 Transaction prepared');

      // 8. Send transaction - this will be a User Operation from the smart account
      // The session key signs it, but the transaction comes FROM the smart account
      const result = await sendTransaction({
        transaction,
        account: smartAccount, // ← IMPORTANT: Use smart account, not personal account!
      });

      console.log('[TransactionService] ✅ User Operation sent!');
      console.log('[TransactionService] TX Hash:', result.transactionHash);

      return {
        transactionHash: result.transactionHash,
        success: true,
      };
    } catch (error: any) {
      console.error('[TransactionService] ❌ Transaction failed:', error);

      return {
        transactionHash: '',
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  /**
   * Validate transaction against smart account permissions
   */
  private async validateTransaction(
    request: PrepareTransactionRequest,
    account: any
  ): Promise<void> {
    const { permissions } = account;

    // 1. Check if target is approved
    const isTargetApproved =
      permissions.approvedTargets.includes(request.to.toLowerCase()) ||
      permissions.approvedTargets.includes('*'); // Wildcard

    if (!isTargetApproved) {
      throw new Error(
        `Target ${request.to} is not in approved targets list`
      );
    }

    // 2. Check native token limit per transaction
    const valueInWei = BigInt(toWei(request.value));
    const limitInWei = BigInt(toWei(permissions.nativeTokenLimitPerTransaction));

    if (valueInWei > limitInWei) {
      throw new Error(
        `Transaction value ${request.value} ETH exceeds limit ${
          Number(limitInWei) / 1e18
        } ETH`
      );
    }

    // 3. Check time window
    const now = Math.floor(Date.now() / 1000);
    if (now < permissions.startTimestamp || now > permissions.endTimestamp) {
      throw new Error('Transaction outside permitted time window');
    }

    console.log('[TransactionService] ✅ All permission checks passed');
  }

  /**
   * Validate session key permissions for a specific smart account
   * (Can be called from frontend to check before requesting signature)
   */
  async validateSessionPermissions(
    smartAccountAddress: string,
    to: string,
    value: string
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const account = await this.smartAccountService.getSmartAccount(
        smartAccountAddress
      );

      if (!account) {
        return { valid: false, reason: 'Smart account not found' };
      }

      // Check expiration
      if (Date.now() > account.expiresAt) {
        return { valid: false, reason: 'Session key expired' };
      }

      // Check target
      const isTargetApproved =
        account.permissions.approvedTargets.includes(to.toLowerCase()) ||
        account.permissions.approvedTargets.includes('*');

      if (!isTargetApproved) {
        return { valid: false, reason: 'Target not approved' };
      }

      // Check amount
      const valueInWei = BigInt(toWei(value));
      const limitInWei = BigInt(
        toWei(account.permissions.nativeTokenLimitPerTransaction)
      );

      if (valueInWei > limitInWei) {
        return {
          valid: false,
          reason: `Amount exceeds limit (max: ${Number(limitInWei) / 1e18} ETH)`,
        };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, reason: error.message };
    }
  }
}
