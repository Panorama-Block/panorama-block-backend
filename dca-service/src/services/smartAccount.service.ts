import { DatabaseService } from './database.service';
import { SmartAccountData, SmartAccountPermissions, CreateSmartAccountRequest } from '../types';
import { encryptPrivateKey, generatePrivateKey, privateKeyToAddress, decryptPrivateKey } from '../utils/encryption';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { smartWallet } from 'thirdweb/wallets';
import { privateKeyToAccount } from 'thirdweb/wallets';

export class SmartAccountService {
  private client: any;
  private db: DatabaseService;

  constructor() {
    // Initialize Thirdweb client
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error('THIRDWEB_SECRET_KEY is required in .env file!');
    }

    this.client = createThirdwebClient({
      secretKey: secretKey,
    });

    this.db = DatabaseService.getInstance();
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
    const personalAccount = privateKeyToAccount({
      client: this.client,
      privateKey: sessionKeyPrivate,
    });

    const wallet = smartWallet({
      chain: defineChain(1), // Ethereum mainnet (can be configurable)
      gasless: false,
    });

    const smartAccount = await wallet.connect({
      client: this.client,
      personalAccount,
    });

    const smartAccountAddress = smartAccount.address;

    console.log('[SmartAccountService] ✅ Smart account deployed:', smartAccountAddress);

    // 4. Encrypt session key
    const encryptedKey = encryptPrivateKey(sessionKeyPrivate);

    // 5. Save to database (transaction)
    await this.db.transaction(async (client) => {
      // Ensure user exists in users table
      await client.query(
        `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [request.userId]
      );

      // Insert smart account
      await client.query(
        `INSERT INTO smart_accounts (
          address, user_id, name, created_at, session_key_address,
          expires_at, approved_targets, native_token_limit,
          start_timestamp, end_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          smartAccountAddress,
          request.userId,
          request.name,
          Date.now(),
          sessionKeyAddress,
          endTimestamp * 1000,
          JSON.stringify(request.permissions.approvedTargets),
          request.permissions.nativeTokenLimit,
          startTimestamp,
          endTimestamp
        ]
      );

      // Insert encrypted session key
      await client.query(
        `INSERT INTO session_keys (smart_account_address, encrypted_key, expires_at)
         VALUES ($1, $2, $3)`,
        [smartAccountAddress, encryptedKey, endTimestamp * 1000]
      );
    });

    console.log('[SmartAccountService] ✅ Smart account created successfully');
    console.log('[SmartAccountService] 🔒 Session key stored securely (encrypted)');

    return {
      smartAccountAddress,
      sessionKeyAddress,
      expiresAt: new Date(endTimestamp * 1000)
    };
  }

  /**
   * Get all smart accounts for a user
   */
  async getUserAccounts(userId: string): Promise<SmartAccountData[]> {
    console.log('[SmartAccountService] Fetching accounts for user:', userId);

    const result = await this.db.query(
      `SELECT
        address,
        user_id as "userId",
        name,
        created_at as "createdAt",
        session_key_address as "sessionKeyAddress",
        expires_at as "expiresAt",
        approved_targets as "approvedTargets",
        native_token_limit as "nativeTokenLimitPerTransaction",
        start_timestamp as "startTimestamp",
        end_timestamp as "endTimestamp"
       FROM smart_accounts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const accounts: SmartAccountData[] = result.rows.map(row => ({
      address: row.address,
      userId: row.userId,
      name: row.name,
      createdAt: parseInt(row.createdAt as any),
      sessionKeyAddress: row.sessionKeyAddress,
      expiresAt: parseInt(row.expiresAt as any),
      permissions: {
        approvedTargets: row.approvedTargets as any,
        nativeTokenLimitPerTransaction: row.nativeTokenLimitPerTransaction as any,
        startTimestamp: parseInt(row.startTimestamp as any),
        endTimestamp: parseInt(row.endTimestamp as any),
      }
    }));

    console.log(`[SmartAccountService] Found ${accounts.length} accounts`);
    return accounts;
  }

  /**
   * Get single smart account data
   */
  async getSmartAccount(address: string): Promise<SmartAccountData | null> {
    const result = await this.db.query(
      `SELECT
        address,
        user_id as "userId",
        name,
        created_at as "createdAt",
        session_key_address as "sessionKeyAddress",
        expires_at as "expiresAt",
        approved_targets as "approvedTargets",
        native_token_limit as "nativeTokenLimitPerTransaction",
        start_timestamp as "startTimestamp",
        end_timestamp as "endTimestamp"
       FROM smart_accounts
       WHERE address = $1`,
      [address]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      address: row.address,
      userId: row.userId,
      name: row.name,
      createdAt: parseInt(row.createdAt),
      sessionKeyAddress: row.sessionKeyAddress,
      expiresAt: parseInt(row.expiresAt),
      permissions: {
        approvedTargets: row.approvedTargets,
        nativeTokenLimitPerTransaction: row.nativeTokenLimitPerTransaction,
        startTimestamp: parseInt(row.startTimestamp),
        endTimestamp: parseInt(row.endTimestamp),
      }
    };
  }

  /**
   * Delete smart account
   */
  async deleteSmartAccount(address: string, userId: string): Promise<void> {
    console.log('[SmartAccountService] Deleting smart account:', address);

    // All related data will be deleted via CASCADE
    await this.db.query(
      `DELETE FROM smart_accounts WHERE address = $1 AND user_id = $2`,
      [address, userId]
    );

    console.log('[SmartAccountService] ✅ Smart account deleted');
  }

  /**
   * Get decrypted session key (for internal use by executor)
   */
  async getSessionKey(smartAccountAddress: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT encrypted_key FROM session_keys WHERE smart_account_address = $1`,
      [smartAccountAddress]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const encryptedKey = result.rows[0].encrypted_key;
    return decryptPrivateKey(encryptedKey);
  }
}
