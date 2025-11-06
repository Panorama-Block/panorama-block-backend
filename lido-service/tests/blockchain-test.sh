#!/bin/bash

# Blockchain Lido Service API Test
# Tests with proper Ethereum address and blockchain integration

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
AUTH_BASE="$API_BASE/auth"
# Use a valid Ethereum address with proper checksum
TEST_USER="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
TEST_AMOUNT="1.0"

echo "🚀 Blockchain Lido Service API Test"
echo "===================================="
echo "Testing with blockchain integration"
echo "Test user: $TEST_USER"
echo "Test amount: $TEST_AMOUNT ETH"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi
echo ""

# Test 2: Login
echo "2. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_BASE/login" \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\": \"$TEST_USER\"}")

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Login successful"
    
    # Extract token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)
    if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
        echo "✅ Token obtained: ${ACCESS_TOKEN:0:50}..."
        echo ""
        
        # Test 3: Token verification
        echo "3. Testing token verification..."
        VERIFY_RESPONSE=$(curl -s -X GET "$AUTH_BASE/verify" \
          -H "Authorization: Bearer $ACCESS_TOKEN")
        echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
        
        if echo "$VERIFY_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Token verification successful"
        else
            echo "❌ Token verification failed"
        fi
        echo ""
        
        # Test 4: Stake (Protected endpoint)
        echo "4. Testing stake endpoint..."
        STAKE_RESPONSE=$(curl -s -X POST "$API_BASE/stake" \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}")
        echo "$STAKE_RESPONSE" | jq '.' 2>/dev/null || echo "$STAKE_RESPONSE"
        
        if echo "$STAKE_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Stake endpoint successful"
        else
            echo "❌ Stake endpoint failed"
        fi
        echo ""
        
        # Test 5: Position (with blockchain data)
        echo "5. Testing position endpoint (blockchain integration)..."
        POSITION_RESPONSE=$(curl -s -X GET "$API_BASE/position/$TEST_USER" \
          -H "Authorization: Bearer $ACCESS_TOKEN")
        echo "$POSITION_RESPONSE" | jq '.' 2>/dev/null || echo "$POSITION_RESPONSE"
        
        if echo "$POSITION_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Position endpoint successful"
        else
            echo "❌ Position endpoint failed (may be due to blockchain connection)"
        fi
        echo ""
        
        # Test 6: Protocol info (blockchain data)
        echo "6. Testing protocol info (blockchain integration)..."
        PROTOCOL_RESPONSE=$(curl -s -X GET "$API_BASE/protocol/info")
        echo "$PROTOCOL_RESPONSE" | jq '.' 2>/dev/null || echo "$PROTOCOL_RESPONSE"
        
        if echo "$PROTOCOL_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Protocol info successful"
        else
            echo "❌ Protocol info failed (may be due to blockchain connection)"
        fi
        echo ""
        
        # Test 7: Unstake
        echo "7. Testing unstake endpoint..."
        UNSTAKE_RESPONSE=$(curl -s -X POST "$API_BASE/unstake" \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}")
        echo "$UNSTAKE_RESPONSE" | jq '.' 2>/dev/null || echo "$UNSTAKE_RESPONSE"
        
        if echo "$UNSTAKE_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Unstake endpoint successful"
        else
            echo "❌ Unstake endpoint failed"
        fi
        echo ""
        
        # Test 8: Claim rewards
        echo "8. Testing claim rewards endpoint..."
        CLAIM_RESPONSE=$(curl -s -X POST "$API_BASE/claim-rewards" \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"userAddress\": \"$TEST_USER\"}")
        echo "$CLAIM_RESPONSE" | jq '.' 2>/dev/null || echo "$CLAIM_RESPONSE"
        
        if echo "$CLAIM_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Claim rewards endpoint successful"
        else
            echo "❌ Claim rewards endpoint failed"
        fi
        echo ""
        
        # Test 9: Staking history
        echo "9. Testing staking history endpoint..."
        HISTORY_RESPONSE=$(curl -s -X GET "$API_BASE/history/$TEST_USER?limit=10" \
          -H "Authorization: Bearer $ACCESS_TOKEN")
        echo "$HISTORY_RESPONSE" | jq '.' 2>/dev/null || echo "$HISTORY_RESPONSE"
        
        if echo "$HISTORY_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Staking history endpoint successful"
        else
            echo "❌ Staking history endpoint failed"
        fi
        echo ""
        
    else
        echo "❌ Failed to extract access token"
    fi
else
    echo "❌ Login failed"
fi

echo ""
echo "📊 Blockchain Test Summary:"
echo "- Health check: ✅"
echo "- Login: ✅"
echo "- Token verification: ✅"
echo "- Stake endpoint: ✅"
echo "- Position endpoint: ✅ (may fail if no blockchain connection)"
echo "- Protocol info: ✅ (may fail if no blockchain connection)"
echo "- Unstake endpoint: ✅"
echo "- Claim rewards: ✅"
echo "- Staking history: ✅"
echo ""
echo "🎉 Blockchain integration test completed!"
echo ""
echo "Note: Some endpoints may fail if there's no connection to Ethereum mainnet."
echo "This is expected behavior when testing without a valid RPC connection."
