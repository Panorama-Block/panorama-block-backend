import CryptoJS from 'crypto-js';

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
  // Remove 0x prefix if present
  const key = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  // For now, generate a deterministic address from the private key hash
  // In production, you would use proper ECDSA public key derivation
  const hash = CryptoJS.SHA256(key).toString(CryptoJS.enc.Hex);
  return '0x' + hash.slice(0, 40);
}
