#!/bin/bash

# Quick Lido Service API Test
# Simple and fast testing of main endpoints

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
AUTH_BASE="$API_BASE/auth"
TEST_USER="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"

echo "🚀 Quick Lido Service API Test"
echo "================================"

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Login
echo "2. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_BASE/login" \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\": \"$TEST_USER\"}")

echo "$LOGIN_RESPONSE" | jq '.' || echo "❌ Login failed"
echo ""

# Extract token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)

if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo "✅ Token obtained: ${ACCESS_TOKEN:0:50}..."
    echo ""
    
    # Test 3: Protected endpoint
    echo "3. Testing protected endpoint (stake)..."
    curl -s -X POST "$API_BASE/stake" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"userAddress\": \"$TEST_USER\", \"amount\": \"1.0\"}" | jq '.' || echo "❌ Stake failed"
    echo ""
    
    # Test 4: Position
    echo "4. Testing position endpoint..."
    curl -s -X GET "$API_BASE/position/$TEST_USER" \
      -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.' || echo "❌ Position failed"
    echo ""
    
    # Test 5: Protocol info
    echo "5. Testing protocol info..."
    curl -s -X GET "$API_BASE/protocol/info" | jq '.' || echo "❌ Protocol info failed"
    echo ""
    
else
    echo "❌ Failed to get access token"
fi

echo "✅ Quick test completed!"
