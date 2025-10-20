import CryptoJS from 'crypto-js';
import { privateKeyToAccount as viemPrivateKeyToAccount } from 'viem/accounts';

const ENCRYPTION_KEY = process.env.ENCRYPTION_PASSWORD || 'default-key-change-in-production';

/**
 * Encrypt a private key for secure storage
 */
export function encryptPrivateKey(privateKey: string): string {
  return CryptoJS.AES.encrypt(privateKey, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt a private key from storage
 */
export function decryptPrivateKey(encryptedKey: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Generate a random private key (32 bytes hex)
 */
export function generatePrivateKey(): string {
  // Generate 32 random bytes
  const randomBytes = CryptoJS.lib.WordArray.random(32);
  return '0x' + randomBytes.toString(CryptoJS.enc.Hex);
}

/**
 * Derive address from private key using crypto
 * Uses keccak256 hash and ECDSA public key derivation
 */
export function privateKeyToAddress(privateKey: string): string {
  const account = viemPrivateKeyToAccount(privateKey as `0x${string}`);
  return account.address;
}
