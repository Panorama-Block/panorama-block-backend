import { RedisClientType } from 'redis';
import { SmartAccountData, SmartAccountPermissions, CreateSmartAccountRequest } from '../types';
import { encryptPrivateKey, generatePrivateKey, privateKeyToAddress } from '../utils/encryption';
import { createThirdwebClient, getContract, defineChain } from 'thirdweb';
import { smartWallet } from 'thirdweb/wallets';
import { privateKeyToAccount } from 'thirdweb/wallets';

export class SmartAccountService {
  private client: any;

  constructor(private redisClient: RedisClientType) {
    // Initialize Thirdweb client
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error('THIRDWEB_SECRET_KEY is required in .env file!');
    }

    this.client = createThirdwebClient({
      secretKey: secretKey,
    });
  }

  /**
   * Create a new smart account with session keys
   * SECURITY: Private key is NEVER returned to frontend
   */
  async createSmartAccount(request: CreateSmartAccountRequest): Promise<{
    smartAccountAddress: string;
    sessionKeyAddress: string;
    expiresAt: Date;
  }> {
    console.log('[SmartAccountService] Creating smart account for user:', request.userId);

    // 1. Generate session key pair (this will be an authorized signer)
    const sessionKeyPrivate = generatePrivateKey();
    const sessionKeyAddress = privateKeyToAddress(sessionKeyPrivate);

    console.log('[SmartAccountService] Session key generated:', sessionKeyAddress);

    // 2. Calculate timestamps
    const startTimestamp = Math.floor(Date.now() / 1000);
    const endTimestamp = startTimestamp + (request.permissions.durationDays * 86400);

    // 3. Create REAL smart account using Thirdweb
    // The session key will be the personal account that controls the smart wallet
    const personalAccount = privateKeyToAccount({
      client: this.client,
      privateKey: sessionKeyPrivate,
    });

    // Create smart wallet with the session key as admin
    const wallet = smartWallet({
      chain: defineChain(1), // Ethereum mainnet (can be configurable)
      gasless: false, // Set to true if using sponsored transactions
    });

    // Connect the wallet with the personal account (session key)
    const smartAccount = await wallet.connect({
      client: this.client,
      personalAccount,
    });

    const smartAccountAddress = smartAccount.address;

    console.log('[SmartAccountService] ✅ Smart account deployed:', smartAccountAddress);

    // 4. Prepare data
    const permissions: SmartAccountPermissions = {
      approvedTargets: request.permissions.approvedTargets,
      nativeTokenLimitPerTransaction: request.permissions.nativeTokenLimit,
      startTimestamp,
      endTimestamp
    };

    const accountData: SmartAccountData = {
      address: smartAccountAddress, // Add the address field
      userId: request.userId,
      name: request.name,
      createdAt: Date.now(),
      sessionKeyAddress,
      expiresAt: endTimestamp * 1000,
      permissions
    };

    // 5. Encrypt session key
    const encryptedKey = encryptPrivateKey(sessionKeyPrivate);

    // 6. Save to Redis (atomic transaction)
    const ttl = endTimestamp - startTimestamp;
    const multi = this.redisClient.multi();

    // Store smart account metadata
    multi.hSet(`smart-account:${smartAccountAddress}`, {
      address: smartAccountAddress,
      userId: accountData.userId,
      name: accountData.name,
      createdAt: accountData.createdAt.toString(),
      sessionKeyAddress: accountData.sessionKeyAddress,
      expiresAt: accountData.expiresAt.toString(),
      permissions: JSON.stringify(accountData.permissions)
    });

    // Store encrypted session key with TTL
    multi.set(`session-key:${smartAccountAddress}`, encryptedKey, { EX: ttl });

    // Add to user's accounts index
    multi.sAdd(`user:accounts:${request.userId}`, smartAccountAddress);

    await multi.exec();

    console.log('[SmartAccountService] ✅ Smart account created successfully');
    console.log('[SmartAccountService] 🔒 Session key stored securely (encrypted)');

    // SECURITY: NEVER return private key to frontend!
    return {
      smartAccountAddress,
      sessionKeyAddress, // Only public address
      expiresAt: new Date(endTimestamp * 1000)
    };
  }

  /**
   * Get all smart accounts for a user
   */
  async getUserAccounts(userId: string): Promise<SmartAccountData[]> {
    console.log('[SmartAccountService] Fetching accounts for user:', userId);

    // Get list of account addresses
    const accountAddresses = await this.redisClient.sMembers(`user:accounts:${userId}`);

    if (accountAddresses.length === 0) {
      console.log('[SmartAccountService] No accounts found for user');
      return [];
    }

    // Fetch metadata for each account
    const accounts: SmartAccountData[] = [];

    for (const address of accountAddresses) {
      const data = await this.redisClient.hGetAll(`smart-account:${address}`);

      if (Object.keys(data).length === 0) {
        // Account data not found (possibly expired), remove from index
        await this.redisClient.sRem(`user:accounts:${userId}`, address);
        continue;
      }

      accounts.push({
        address: data.address || address,
        userId: data.userId,
        name: data.name,
        createdAt: parseInt(data.createdAt),
        sessionKeyAddress: data.sessionKeyAddress,
        expiresAt: parseInt(data.expiresAt),
        permissions: JSON.parse(data.permissions)
      });
    }

    console.log(`[SmartAccountService] Found ${accounts.length} accounts`);
    return accounts;
  }

  /**
   * Get single smart account data
   */
  async getSmartAccount(address: string): Promise<SmartAccountData | null> {
    const data = await this.redisClient.hGetAll(`smart-account:${address}`);

    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      address: address, // Add the address field
      userId: data.userId,
      name: data.name,
      createdAt: parseInt(data.createdAt),
      sessionKeyAddress: data.sessionKeyAddress,
      expiresAt: parseInt(data.expiresAt),
      permissions: JSON.parse(data.permissions)
    };
  }

  /**
   * Delete smart account
   */
  async deleteSmartAccount(address: string, userId: string): Promise<void> {
    console.log('[SmartAccountService] Deleting smart account:', address);

    const multi = this.redisClient.multi();

    // Remove account metadata
    multi.del(`smart-account:${address}`);

    // Remove encrypted session key
    multi.del(`session-key:${address}`);

    // Remove from user index
    multi.sRem(`user:accounts:${userId}`, address);

    // Remove execution history
    multi.del(`dca-history:${address}`);

    await multi.exec();

    console.log('[SmartAccountService] ✅ Smart account deleted');
  }


  /**
   * Get decrypted session key (for internal use by executor)
   */
  async getSessionKey(smartAccountAddress: string): Promise<string | null> {
    const encryptedKey = await this.redisClient.get(`session-key:${smartAccountAddress}`);

    if (!encryptedKey) {
      return null;
    }

    const { decryptPrivateKey } = await import('../utils/encryption');
    return decryptPrivateKey(encryptedKey);
  }
}
