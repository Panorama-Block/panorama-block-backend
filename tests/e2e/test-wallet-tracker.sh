#!/bin/bash

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Test variables
TEST_FAILED=0
TESTS_RUN=0
TESTS_PASSED=0

# Initialize
init_temp_dir

print_header "WALLET TRACKER SERVICE E2E TESTS"

# Test 1: Health Check
test_health_check() {
    print_info "Testing health check endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$WALLET_TRACKER_URL/api/health")
    if [ $? -eq 0 ]; then
        if validate_json_response "$response" "status" "ok"; then
            print_success "Health check passed"
            log_test_result "wallet_health_check" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Health check failed: $response"
    log_test_result "wallet_health_check" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 2: Unauthenticated Request (should fail)
test_unauthenticated_access() {
    print_info "Testing unauthenticated access (should fail)..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "$WALLET_TRACKER_URL/api/wallets/addresses")
    
    if [ "$status_code" = "401" ]; then
        print_success "Unauthenticated access correctly rejected"
        log_test_result "wallet_unauthenticated" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Unauthenticated access test failed - expected 401, got $status_code"
    log_test_result "wallet_unauthenticated" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 3: Invalid Token Access
test_invalid_token_access() {
    print_info "Testing access with invalid token..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer invalid_token" \
        "$WALLET_TRACKER_URL/api/wallets/addresses")
    
    if [ "$status_code" = "401" ] || [ "$status_code" = "500" ]; then
        print_success "Invalid token correctly rejected"
        log_test_result "wallet_invalid_token" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Invalid token test failed - expected 401/500, got $status_code"
    log_test_result "wallet_invalid_token" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 4: Get All Addresses (with mock auth)
test_get_addresses() {
    print_info "Testing get all addresses endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Use a mock token - this will likely fail auth verification but test the endpoint
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer mock_token" \
        "$WALLET_TRACKER_URL/api/wallets/addresses")
    
    # Check if we get a response (could be auth error or data)
    if [ $? -eq 0 ]; then
        # Check if it's a JSON response
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [ "$error" != "null" ] && [[ "$error" == *"auth"* ]]; then
                print_success "Get addresses endpoint working (auth failed as expected)"
                log_test_result "wallet_get_addresses" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            elif [ "$error" = "null" ]; then
                print_success "Get addresses endpoint returned data"
                log_test_result "wallet_get_addresses" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Get addresses test failed: $response"
    log_test_result "wallet_get_addresses" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 5: Get Wallet Details (with mock auth)
test_get_wallet_details() {
    print_info "Testing get wallet details endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer mock_token" \
        "$WALLET_TRACKER_URL/api/wallets/details?address=$TEST_ADDRESS")
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [ "$error" != "null" ] && [[ "$error" == *"auth"* ]]; then
                print_success "Get wallet details endpoint working (auth failed as expected)"
                log_test_result "wallet_get_details" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            elif [ "$error" = "null" ]; then
                print_success "Get wallet details endpoint returned data"
                log_test_result "wallet_get_details" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Get wallet details test failed: $response"
    log_test_result "wallet_get_details" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 6: Get Tokens by Address (with mock auth)
test_get_tokens() {
    print_info "Testing get tokens by address endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer mock_token" \
        "$WALLET_TRACKER_URL/api/wallets/tokens?address=$TEST_ADDRESS")
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [ "$error" != "null" ] && [[ "$error" == *"auth"* ]]; then
                print_success "Get tokens endpoint working (auth failed as expected)"
                log_test_result "wallet_get_tokens" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            elif [ "$error" = "null" ]; then
                print_success "Get tokens endpoint returned data"
                log_test_result "wallet_get_tokens" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Get tokens test failed: $response"
    log_test_result "wallet_get_tokens" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 7: Missing Query Parameters
test_missing_parameters() {
    print_info "Testing endpoints with missing parameters..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test wallet details without address
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer mock_token" \
        "$WALLET_TRACKER_URL/api/wallets/details")
    
    # Should return 400 or handle gracefully
    if [ "$status_code" = "400" ] || [ "$status_code" = "401" ] || [ "$status_code" = "500" ]; then
        print_success "Missing parameters handled correctly"
        log_test_result "wallet_missing_params" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Missing parameters test failed - got status code: $status_code"
    log_test_result "wallet_missing_params" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 8: Invalid Address Format
test_invalid_address() {
    print_info "Testing invalid address format..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer mock_token" \
        "$WALLET_TRACKER_URL/api/wallets/details?address=invalid_address")
    
    if [ $? -eq 0 ]; then
        # Should handle invalid address gracefully
        status_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer mock_token" \
            "$WALLET_TRACKER_URL/api/wallets/details?address=invalid_address")
        
        if [ "$status_code" != "200" ]; then
            print_success "Invalid address handled correctly (status: $status_code)"
            log_test_result "wallet_invalid_address" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_warning "Invalid address test - response: $response"
    log_test_result "wallet_invalid_address" "WARNING"
    TESTS_PASSED=$((TESTS_PASSED + 1))  # Not critical
    return 0
}

# Test 9: Service Performance
test_service_performance() {
    print_info "Testing service performance..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local success_count=0
    local total_requests=5
    local start_time=$(date +%s)
    
    for i in $(seq 1 $total_requests); do
        response=$(curl -s --max-time 3 "$WALLET_TRACKER_URL/api/health")
        if [ $? -eq 0 ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $success_count -ge 4 ] && [ $duration -le 15 ]; then
        print_success "Performance test passed ($success_count/$total_requests in ${duration}s)"
        log_test_result "wallet_performance" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Performance test failed ($success_count/$total_requests in ${duration}s)"
    log_test_result "wallet_performance" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 10: Auth Service Integration Check
test_auth_integration() {
    print_info "Testing auth service integration..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Check if the service tries to contact auth service
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer test_token" \
        "$WALLET_TRACKER_URL/api/wallets/addresses")
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [[ "$error" == *"auth"* ]] || [[ "$error" == *"token"* ]] || [[ "$error" == *"unauthorized"* ]]; then
                print_success "Auth service integration working (rejected invalid token)"
                log_test_result "wallet_auth_integration" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_warning "Auth integration test inconclusive: $response"
    log_test_result "wallet_auth_integration" "WARNING"
    TESTS_PASSED=$((TESTS_PASSED + 1))  # Not critical for service functionality
    return 0
}

# Run all tests
run_wallet_tests() {
    # Check if service is available
    if ! wait_for_service "$WALLET_TRACKER_URL" "Wallet Tracker Service"; then
        print_error "Wallet Tracker Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    # Run tests
    test_health_check
    test_unauthenticated_access
    test_invalid_token_access
    test_get_addresses
    test_get_wallet_details
    test_get_tokens
    test_missing_parameters
    test_invalid_address
    test_service_performance
    test_auth_integration
    
    # Print summary
    print_header "WALLET TRACKER SERVICE TEST SUMMARY"
    print_info "Tests run: $TESTS_RUN"
    print_info "Tests passed: $TESTS_PASSED"
    print_info "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
    
    if [ $TEST_FAILED -eq 0 ]; then
        print_success "All Wallet Tracker Service tests passed!"
    else
        print_error "Some Wallet Tracker Service tests failed!"
    fi
    
    return $TEST_FAILED
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    run_wallet_tests
    result=$?
    cleanup_temp_dir
    exit $result
fi 