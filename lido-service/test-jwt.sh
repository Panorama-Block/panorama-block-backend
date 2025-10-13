#!/bin/bash

# JWT Authentication Test Script for Lido Service
# This script demonstrates how to use JWT authentication with the Lido Service API

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
AUTH_BASE="$API_BASE/auth"

echo "🔐 Testing JWT Authentication for Lido Service"
echo "=============================================="

# Test user address
USER_ADDRESS="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"

echo ""
echo "1. Testing login endpoint..."
echo "POST $AUTH_BASE/login"
echo "Body: {\"userAddress\": \"$USER_ADDRESS\"}"

LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_BASE/login" \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\": \"$USER_ADDRESS\"}")

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract tokens from response
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken' 2>/dev/null)

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token. Make sure the service is running."
  exit 1
fi

echo ""
echo "✅ Login successful!"
echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo "Refresh Token: ${REFRESH_TOKEN:0:50}..."

echo ""
echo "2. Testing token verification..."
echo "GET $AUTH_BASE/verify"
echo "Authorization: Bearer $ACCESS_TOKEN"

VERIFY_RESPONSE=$(curl -s -X GET "$AUTH_BASE/verify" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"

echo ""
echo "3. Testing token info endpoint..."
echo "GET $AUTH_BASE/token-info"

TOKEN_INFO_RESPONSE=$(curl -s -X GET "$AUTH_BASE/token-info" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
echo "$TOKEN_INFO_RESPONSE" | jq '.' 2>/dev/null || echo "$TOKEN_INFO_RESPONSE"

echo ""
echo "4. Testing protected staking endpoint..."
echo "POST $API_BASE/stake"
echo "Authorization: Bearer $ACCESS_TOKEN"

STAKE_RESPONSE=$(curl -s -X POST "$API_BASE/stake" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\": \"$USER_ADDRESS\", \"amount\": \"1.0\"}")

echo "Response:"
echo "$STAKE_RESPONSE" | jq '.' 2>/dev/null || echo "$STAKE_RESPONSE"

echo ""
echo "5. Testing token refresh..."
echo "POST $AUTH_BASE/refresh"

REFRESH_RESPONSE=$(curl -s -X POST "$AUTH_BASE/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo "Response:"
echo "$REFRESH_RESPONSE" | jq '.' 2>/dev/null || echo "$REFRESH_RESPONSE"

# Extract new access token
NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)

if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ -n "$NEW_ACCESS_TOKEN" ]; then
  echo ""
  echo "✅ Token refresh successful!"
  echo "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
  
  echo ""
  echo "6. Testing with new access token..."
  echo "GET $API_BASE/position/$USER_ADDRESS"
  
  POSITION_RESPONSE=$(curl -s -X GET "$API_BASE/position/$USER_ADDRESS" \
    -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
  
  echo "Response:"
  echo "$POSITION_RESPONSE" | jq '.' 2>/dev/null || echo "$POSITION_RESPONSE"
fi

echo ""
echo "7. Testing logout..."
echo "POST $AUTH_BASE/logout"

LOGOUT_RESPONSE=$(curl -s -X POST "$AUTH_BASE/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
echo "$LOGOUT_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGOUT_RESPONSE"

echo ""
echo "8. Testing invalid token..."
echo "GET $AUTH_BASE/verify"
echo "Authorization: Bearer invalid_token"

INVALID_RESPONSE=$(curl -s -X GET "$AUTH_BASE/verify" \
  -H "Authorization: Bearer invalid_token")

echo "Response:"
echo "$INVALID_RESPONSE" | jq '.' 2>/dev/null || echo "$INVALID_RESPONSE"

echo ""
echo "✅ JWT Authentication testing completed!"
echo ""
echo "Summary:"
echo "- Login: Generate access and refresh tokens"
echo "- Verify: Validate token and get user info"
echo "- Refresh: Get new access token using refresh token"
echo "- Protected endpoints: Require valid access token"
echo "- Logout: Client-side token invalidation"
echo ""
echo "Usage in your application:"
echo "1. Call POST /api/lido/auth/login with userAddress"
echo "2. Store the accessToken and refreshToken"
echo "3. Include 'Authorization: Bearer <accessToken>' in requests"
echo "4. When access token expires, use refresh token to get new one"
