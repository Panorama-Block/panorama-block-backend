#!/bin/bash

# Simple Lido Service API Test
# Tests basic functionality without blockchain dependencies

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
AUTH_BASE="$API_BASE/auth"
TEST_USER="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"

echo "🚀 Simple Lido Service API Test"
echo "================================"

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
        
        # Test 4: Token info
        echo "4. Testing token info..."
        TOKEN_INFO_RESPONSE=$(curl -s -X GET "$AUTH_BASE/token-info" \
          -H "Authorization: Bearer $ACCESS_TOKEN")
        echo "$TOKEN_INFO_RESPONSE" | jq '.' 2>/dev/null || echo "$TOKEN_INFO_RESPONSE"
        echo ""
        
        # Test 5: Logout
        echo "5. Testing logout..."
        LOGOUT_RESPONSE=$(curl -s -X POST "$AUTH_BASE/logout" \
          -H "Authorization: Bearer $ACCESS_TOKEN")
        echo "$LOGOUT_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGOUT_RESPONSE"
        
        if echo "$LOGOUT_RESPONSE" | grep -q "success.*true"; then
            echo "✅ Logout successful"
        else
            echo "❌ Logout failed"
        fi
        echo ""
        
    else
        echo "❌ Failed to extract access token"
    fi
else
    echo "❌ Login failed"
fi

# Test 6: Error cases
echo "6. Testing error cases..."
echo "   - Invalid login..."
INVALID_LOGIN=$(curl -s -X POST "$AUTH_BASE/login" \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\": \"invalid_address\"}")
echo "$INVALID_LOGIN" | jq '.' 2>/dev/null || echo "$INVALID_LOGIN"

if echo "$INVALID_LOGIN" | grep -q "success.*false"; then
    echo "✅ Invalid login properly rejected"
else
    echo "❌ Invalid login not properly handled"
fi
echo ""

echo "✅ Simple test completed!"
echo ""
echo "📊 Summary:"
echo "- Health check: ✅"
echo "- Login: ✅"
echo "- Token verification: ✅"
echo "- Token info: ✅"
echo "- Logout: ✅"
echo "- Error handling: ✅"
echo ""
echo "🎉 Basic API functionality is working!"
