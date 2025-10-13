#!/usr/bin/env node

/**
 * JWT Secrets Generator for Lido Service
 * This script generates secure JWT secrets for production use
 */

const crypto = require('crypto');

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateBase64Secret(length = 48) {
  return crypto.randomBytes(length).toString('base64');
}

function generateUUIDSecret() {
  return crypto.randomUUID();
}

console.log('🔐 JWT Secrets Generator for Lido Service');
console.log('==========================================');
console.log('');

console.log('Generated JWT Secrets:');
console.log('');

// Generate JWT_SECRET (64 bytes = 128 hex characters)
const jwtSecret = generateSecureSecret(64);
console.log('JWT_SECRET=' + jwtSecret);
console.log('');

// Generate JWT_REFRESH_SECRET (64 bytes = 128 hex characters)
const jwtRefreshSecret = generateSecureSecret(64);
console.log('JWT_REFRESH_SECRET=' + jwtRefreshSecret);
console.log('');

// Alternative Base64 secrets (shorter but equally secure)
console.log('Alternative Base64 secrets:');
console.log('JWT_SECRET=' + generateBase64Secret(48));
console.log('JWT_REFRESH_SECRET=' + generateBase64Secret(48));
console.log('');

// UUID-based secrets (human-readable but secure)
console.log('UUID-based secrets:');
console.log('JWT_SECRET=' + generateUUIDSecret());
console.log('JWT_REFRESH_SECRET=' + generateUUIDSecret());
console.log('');

console.log('📋 Copy the secrets above to your .env file');
console.log('');
console.log('⚠️  IMPORTANT SECURITY NOTES:');
console.log('- Keep these secrets secure and never commit them to version control');
console.log('- Use different secrets for different environments (dev, staging, prod)');
console.log('- Rotate secrets periodically in production');
console.log('- Store production secrets in secure secret management systems');
console.log('');

console.log('🔧 Environment Configuration:');
console.log('JWT_ISSUER=lido-service');
console.log('JWT_AUDIENCE=panorama-block');
console.log('JWT_ACCESS_EXPIRY=15m');
console.log('JWT_REFRESH_EXPIRY=7d');
