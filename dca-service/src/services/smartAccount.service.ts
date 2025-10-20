import { RedisClientType } from 'redis';
import { SmartAccountData, SmartAccountPermissions, CreateSmartAccountRequest } from '../types';
import { encryptPrivateKey, generatePrivateKey, privateKeyToAddress } from '../utils/encryption';

export class SmartAccountService {
  constructor(private redisClient: RedisClientType) {}

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

    // 1. Generate session key pair
    const sessionKeyPrivate = generatePrivateKey();
    const sessionKeyAddress = privateKeyToAddress(sessionKeyPrivate);

    console.log('[SmartAccountService] Session key generated:', sessionKeyAddress);

    // 2. Calculate timestamps
    const startTimestamp = Math.floor(Date.now() / 1000);
    const endTimestamp = startTimestamp + (request.permissions.durationDays * 86400);

    // 3. Create deterministic smart account address
    // In production, this would call Thirdweb Engine to deploy smart account
    // For now, we generate a deterministic address based on user + timestamp
    const smartAccountIdentifier = `${request.userId}-${Date.now()}`;
    const smartAccountAddress = await this.generateSmartAccountAddress(smartAccountIdentifier);

    console.log('[SmartAccountService] Smart account address:', smartAccountAddress);

    // 4. Prepare data
    const permissions: SmartAccountPermissions = {
      approvedTargets: request.permissions.approvedTargets,
      nativeTokenLimitPerTransaction: request.permissions.nativeTokenLimit,
      startTimestamp,
      endTimestamp
    };

    const accountData: SmartAccountData = {
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
        address: address, // ← IMPORTANTE: Adicionar o address aqui!
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
   * Generate smart account address (deterministic)
   * In production, this would call Thirdweb Engine API
   */
  private async generateSmartAccountAddress(identifier: string): Promise<string> {
    // For demo: create deterministic address from identifier
    const CryptoJS = await import('crypto-js');
    const hash = CryptoJS.SHA256(identifier).toString(CryptoJS.enc.Hex);
    return '0x' + hash.substring(0, 40);
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
