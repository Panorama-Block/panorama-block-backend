#!/bin/bash

# Test script for Liquid Swap Service API
# Usage: ./test-api.sh [PORT]

PORT=${1:-3002}
BASE_URL="http://localhost:$PORT"

echo "🧪 Testing Liquid Swap Service API"
echo "📍 Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local headers=$5
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "🔗 $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" $headers "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method $headers -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Success ($http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ Failed ($http_code)${NC}"
        echo "$body"
    fi
    echo ""
}

# 1. Health Check
test_endpoint "GET" "/health" "Service Health Check"

# 2. Service Info
test_endpoint "GET" "/" "Service Information"

# 3. Swap Module Health (requires auth - will fail without token)
test_endpoint "GET" "/swap/health" "Swap Module Health" "" "-H 'Authorization: Bearer fake-token'"

# 4. Test Swap (requires auth - will fail without token)
swap_data='{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "NATIVE",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000000"
}'

test_endpoint "POST" "/swap/manual" "Execute Swap (will fail without valid JWT)" "$swap_data" "-H 'Authorization: Bearer fake-token'"

# 5. Swap History (requires auth - will fail without token)
test_endpoint "GET" "/swap/history/0x1234567890123456789012345678901234567890" "Get Swap History (will fail without valid JWT)" "" "-H 'Authorization: Bearer fake-token'"

# 6. 404 Test
test_endpoint "GET" "/nonexistent" "404 Test"

echo "🏁 API testing completed!"
echo ""
echo "📝 Notes:"
echo "- Swap endpoints require valid JWT tokens from auth-service"
echo "- Configure environment variables before testing swaps"
echo "- Check logs for detailed error information" 