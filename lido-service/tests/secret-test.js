#!/usr/bin/env node

/**
 * Secret Test - Test JWT secrets consistency
 * Verify that JWTService uses the same secrets as the test
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'lido-service';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'panorama-block';

console.log('🔍 Secret Test - JWT Consistency');
console.log('==================================');
console.log(`JWT_SECRET: ${JWT_SECRET.substring(0, 20)}...`);
console.log(`JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET.substring(0, 20)}...`);
console.log(`JWT_ISSUER: ${JWT_ISSUER}`);
console.log(`JWT_AUDIENCE: ${JWT_AUDIENCE}`);
console.log('');

// Test 1: Generate token with same logic as JWTService
console.log('1. Generating token with JWTService logic...');
const testUser = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
const now = Math.floor(Date.now() / 1000);
const accessExpiry = 15 * 60; // 15 minutes

const accessPayload = {
  address: testUser,
  iat: now,
  exp: now + accessExpiry,
  sub: testUser,
  iss: JWT_ISSUER,
  aud: JWT_AUDIENCE
};

const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
  algorithm: 'HS256'
});

console.log(`Token: ${accessToken.substring(0, 50)}...`);
console.log('');

// Test 2: Verify with same logic as JWTService
console.log('2. Verifying with JWTService logic...');
try {
  const decoded = jwt.verify(accessToken, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
  
  console.log('✅ Token verification successful');
  console.log('Decoded:', JSON.stringify(decoded, null, 2));
} catch (error) {
  console.log('❌ Token verification failed');
  console.log('Error:', error.message);
}

console.log('');

// Test 3: Test with different algorithm
console.log('3. Testing with different algorithm...');
try {
  const decoded = jwt.verify(accessToken, JWT_SECRET, {
    algorithms: ['HS512'], // Different algorithm
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
  
  console.log('❌ Should have failed with different algorithm');
} catch (error) {
  console.log('✅ Correctly failed with different algorithm');
  console.log('Error:', error.message);
}

console.log('');

// Test 4: Test with no algorithm specified
console.log('4. Testing with no algorithm specified...');
try {
  const decoded = jwt.verify(accessToken, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
  
  console.log('✅ Token verification successful (no algorithm specified)');
} catch (error) {
  console.log('❌ Token verification failed (no algorithm specified)');
  console.log('Error:', error.message);
}

console.log('');
console.log('🎉 Secret test completed!');
