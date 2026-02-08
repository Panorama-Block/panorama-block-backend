#!/bin/bash

# Quick Lido Service API Test
# Simple and fast testing of main endpoints

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
TEST_USER="${TEST_USER:-0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6}"
ACCESS_TOKEN="${AUTH_TOKEN:-}"

echo "🚀 Quick Lido Service API Test"
echo "================================"

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "❌ Health check failed"
echo ""

echo "2. Using centralized auth-service token (AUTH_TOKEN env var)"
if [ -z "$ACCESS_TOKEN" ]; then
  echo "⚠️  AUTH_TOKEN not set. Skipping protected endpoint tests."
  echo "   Export a token from your MiniApp session:"
  echo "   export AUTH_TOKEN='eyJ...'"
  echo ""
else
  echo "✅ Token provided: ${ACCESS_TOKEN:0:24}..."
  echo ""

  # Test 3: Protected endpoint
  echo "3. Testing protected endpoint (stake)..."
  curl -s -X POST "$API_BASE/stake" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userAddress\": \"$TEST_USER\", \"amount\": \"0.01\"}" | jq '.' || echo "❌ Stake failed"
  echo ""

  # Test 4: Position (with auth)
  echo "4. Testing position endpoint..."
  curl -s -X GET "$API_BASE/position/$TEST_USER" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.' || echo "❌ Position failed"
  echo ""
fi

# Test 5: Protocol info
echo "5. Testing protocol info..."
curl -s -X GET "$API_BASE/protocol/info" | jq '.' || echo "❌ Protocol info failed"
echo ""

echo "✅ Quick test completed!"
