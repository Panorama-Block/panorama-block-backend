#!/bin/bash

# Lido Service API Test Suite
# Comprehensive testing of all endpoints with JWT authentication

set -e  # Exit on any error

# Configuration
BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"
TEST_USER="${TEST_USER:-0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6}"
TEST_AMOUNT="${TEST_AMOUNT:-0.01}"
ACCESS_TOKEN="${AUTH_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -e "\n${YELLOW}🧪 Testing: $1${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

get_steth_balance_wei() {
    if [ -z "$ACCESS_TOKEN" ]; then
        echo ""
        return 0
    fi

    local resp
    resp=$(curl -s -X GET "$API_BASE/position/$TEST_USER" -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo "")
    if [ -z "$resp" ]; then
        echo ""
        return 0
    fi

    # Position can be missing/undefined when user has no stake; treat as empty
    echo "$resp" | jq -r '.data.stETHBalance // empty' 2>/dev/null || echo ""
}

# Test helper function
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local headers="$4"
    local expected_status="$5"
    local description="$6"
    
    print_test "$description"
    
    local response
    local status_code
    
    if [ -n "$data" ] && [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null || echo "CURL_ERROR")
    elif [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "CURL_ERROR")
    elif [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" \
            -H "$headers" 2>/dev/null || echo "CURL_ERROR")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" 2>/dev/null || echo "CURL_ERROR")
    fi
    
    if [ "$response" = "CURL_ERROR" ]; then
        print_error "Failed to connect to $endpoint"
        return 1
    fi
    
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        print_success "Status $status_code (expected $expected_status)"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "Response: $response_body"
        return 0
    else
        print_error "Status $status_code (expected $expected_status)"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "Response: $response_body"
        return 1
    fi
}

# Check if API is running
check_api_health() {
    print_header "🔍 Checking API Health"
    
    if test_endpoint "GET" "$BASE_URL/health" "" "" "200" "Health Check"; then
        print_success "API is running and healthy"
        return 0
    else
        print_error "API is not running or not responding"
        echo "Please start the API with: npm run dev"
        exit 1
    fi
}

# Test authentication endpoints
test_authentication() {
    print_header "🔐 Authentication (Centralized via auth-service)"

    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "AUTH_TOKEN env var not set"
        print_info "Export a token from your MiniApp session:"
        print_info "  export AUTH_TOKEN='eyJ...'"
        print_info "Also ensure TEST_USER matches the JWT address (protected endpoints enforce it)."
        return 1
    fi

    print_success "Using AUTH_TOKEN: ${ACCESS_TOKEN:0:24}..."

    # Validate token by calling a protected endpoint
    test_endpoint "GET" "$API_BASE/position/$TEST_USER" "" "Authorization: Bearer $ACCESS_TOKEN" "200" "Validate token (position with auth)"
}

# Test staking endpoints (protected)
test_staking_endpoints() {
    print_header "💰 Testing Staking Endpoints (Protected)"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available for protected endpoints"
        return 1
    fi
    
    # Test stake
    test_endpoint "POST" "$API_BASE/stake" "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}" "Authorization: Bearer $ACCESS_TOKEN" "200" "Stake ETH"
    
    # Test unstake (requires stETH balance)
    local steth_balance_wei
    steth_balance_wei="$(get_steth_balance_wei)"
    if [ -n "$steth_balance_wei" ] && [ "$steth_balance_wei" != "0" ]; then
        test_endpoint "POST" "$API_BASE/unstake" "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}" "Authorization: Bearer $ACCESS_TOKEN" "200" "Unstake stETH (Withdrawal Queue)"
    else
        print_info "Skipping unstake test (no stETH balance detected for TEST_USER)."
    fi
    
    # Test claim rewards
    test_endpoint "POST" "$API_BASE/claim-rewards" "{\"userAddress\": \"$TEST_USER\"}" "Authorization: Bearer $ACCESS_TOKEN" "200" "Claim rewards"
}

test_withdrawals_and_tracking_endpoints() {
    print_header "🧾 Testing Withdrawals & Tracking"

    # Withdrawals list (public/optional auth)
    test_endpoint "GET" "$API_BASE/withdrawals/$TEST_USER" "" "" "200" "Get withdrawals (no auth)"
    if [ -n "$ACCESS_TOKEN" ]; then
        test_endpoint "GET" "$API_BASE/withdrawals/$TEST_USER" "" "Authorization: Bearer $ACCESS_TOKEN" "200" "Get withdrawals (with auth)"
    fi

    # Claim withdrawals validation (requires auth)
    if [ -n "$ACCESS_TOKEN" ]; then
        test_endpoint "POST" "$API_BASE/withdrawals/claim" "{\"userAddress\": \"$TEST_USER\", \"requestIds\": []}" "Authorization: Bearer $ACCESS_TOKEN" "400" "Claim withdrawals (empty requestIds rejected)"
    fi

    # Transaction submit validation (requires auth)
    if [ -n "$ACCESS_TOKEN" ]; then
        test_endpoint "POST" "$API_BASE/transaction/submit" "{\"id\": \"tx_test\", \"userAddress\": \"$TEST_USER\"}" "Authorization: Bearer $ACCESS_TOKEN" "400" "Submit tx hash (missing hash rejected)"
    fi

    # Transaction status validation (public)
    test_endpoint "GET" "$API_BASE/transaction/0x123" "" "" "400" "Get tx status (invalid hash format rejected)"
}

# Test public endpoints
test_public_endpoints() {
    print_header "🌐 Testing Public Endpoints"
    
    # Test protocol info
    test_endpoint "GET" "$API_BASE/protocol/info" "" "" "200" "Get protocol information"
    
    # Test position (optional auth)
    test_endpoint "GET" "$API_BASE/position/$TEST_USER" "" "" "200" "Get user position (no auth)"
    
    # Test position with auth
    if [ -n "$ACCESS_TOKEN" ]; then
        test_endpoint "GET" "$API_BASE/position/$TEST_USER" "" "Authorization: Bearer $ACCESS_TOKEN" "200" "Get user position (with auth)"
    fi
    
    # Test staking history
    test_endpoint "GET" "$API_BASE/history/$TEST_USER?limit=10" "" "" "200" "Get staking history"
}

# Test error cases
test_error_cases() {
    print_header "🚫 Testing Error Cases"

    # Test stake without auth
    test_endpoint "POST" "$API_BASE/stake" "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}" "" "401" "Stake without authentication"
    
    # Test invalid token (should be rejected)
    test_endpoint "POST" "$API_BASE/stake" "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}" "Authorization: Bearer invalid_token" "401" "Stake with invalid token"
    
    # Test invalid endpoint
    test_endpoint "GET" "$API_BASE/invalid-endpoint" "" "" "404" "Invalid endpoint"
}

# Test performance
test_performance() {
    print_header "⚡ Testing Performance"
    
    print_test "Multiple concurrent requests"
    
    # Test multiple requests in parallel
    local start_time=$(date +%s%N)
    
    for i in {1..5}; do
        curl -s "$BASE_URL/health" > /dev/null &
    done
    
    wait
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    print_success "5 concurrent requests completed in ${duration}ms"
}

# Test JWT token expiration simulation
test_token_expiration() {
    print_header "⏰ Testing Token Expiration"
    
    # Create a token that will expire quickly (if we had control over expiration)
    print_test "Token expiration handling"
    
    # Test with expired token placeholder (expect 401)
    test_endpoint "POST" "$API_BASE/stake" "{\"userAddress\": \"$TEST_USER\", \"amount\": \"$TEST_AMOUNT\"}" "Authorization: Bearer expired_token_here" "401" "Expired token rejected"
}

# Main test execution
main() {
    print_header "🚀 Lido Service API Test Suite"
    echo "Testing API at: $BASE_URL"
    echo "Test user: $TEST_USER"
    echo "Test amount: $TEST_AMOUNT ETH"
    
    # Check if API is running
    if ! check_api_health; then
        exit 1
    fi
    
    # Run all test suites
    test_authentication
    test_public_endpoints
    test_staking_endpoints
    test_withdrawals_and_tracking_endpoints
    test_error_cases
    test_performance
    test_token_expiration
    
    # Print final results
    print_header "📊 Test Results Summary"
    echo "Total tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed! API is working correctly.${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Please check the API implementation.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"
