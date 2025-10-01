#!/bin/bash

# Test script for Liquid Swap Service API
# Usage: ./test-api.sh [PORT]

PORT=${1:-3002}
BASE_URL="http://localhost:$PORT"
AUTH_TOKEN=${AUTH_TOKEN:-}
ENGINE_ENABLED=${ENGINE_ENABLED:-false}
SMART_ACCOUNT=${SMART_ACCOUNT:-}
SESSION_KEY=${SESSION_KEY:-}
CHAIN_ID_FOR_STATUS=${CHAIN_ID_FOR_STATUS:-1}

if [ -n "$AUTH_TOKEN" ]; then
  AUTH_HEADER=( -H "Authorization: Bearer $AUTH_TOKEN" )
else
  AUTH_HEADER=()
fi

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
    shift 4
    local headers=("$@")
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "🔗 $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "${headers[@]}" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
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

# 3. Quote (requires auth)
quote_body='{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000",
  "unit": "wei"
}'
test_endpoint "POST" "/swap/quote" "Get Quote" "$quote_body" "${AUTH_HEADER[@]}"

# 4. Prepared bundle (requires auth)
prep_body='{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000"
}'
test_endpoint "POST" "/swap/tx" "Get Prepared Tx Bundle" "$prep_body" "${AUTH_HEADER[@]}"

# 5. Execute via Engine (optional, requires auth + ENGINE + session key)
if [ "$ENGINE_ENABLED" = "true" ] && [ -n "$SMART_ACCOUNT" ] && [ -n "$SESSION_KEY" ]; then
  exec_body=$(jq -n --arg sa "$SMART_ACCOUNT" --arg sk "$SESSION_KEY" ' {
    fromChainId: 1,
    toChainId: 137,
    fromToken: "native",
    toToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    amount: "1000000000000000",
    smartAccountAddress: $sa,
    signerAddress: $sk
  }')
  test_endpoint "POST" "/swap/execute" "Execute via Engine (ERC4337)" "$exec_body" "${AUTH_HEADER[@]}"
else
  echo -e "${YELLOW}Skipping execute: set ENGINE_ENABLED=true, SMART_ACCOUNT, SESSION_KEY, AUTH_TOKEN for full test${NC}"
fi

# 6. Swap History (requires auth)
test_endpoint "GET" "/swap/history" "Get Swap History" "" "${AUTH_HEADER[@]}"

# 7. Status check (optional): requires a tx hash and chain id
if [ -n "$LAST_TX_HASH" ]; then
  test_endpoint "GET" "/swap/status/$LAST_TX_HASH?chainId=$CHAIN_ID_FOR_STATUS" "Get Swap Status" "" "${AUTH_HEADER[@]}"
fi

# 8. 404 Test
test_endpoint "GET" "/nonexistent" "404 Test"

echo "🏁 API testing completed!"
echo ""
echo "📝 Notes:"
echo "- Swap endpoints require valid JWT tokens from auth-service"
echo "- Configure environment variables before testing swaps"
echo "- Check logs for detailed error information" 
