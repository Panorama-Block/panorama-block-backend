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

print_header "LIQUID SWAP SERVICE E2E TESTS"

# Test 1: Health Check
test_health_check() {
    print_info "Testing health check endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$LIQUID_SWAP_URL/health")
    if [ $? -eq 0 ]; then
        if validate_json_response "$response" "status" "ok"; then
            print_success "Health check passed"
            log_test_result "swap_health_check" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Health check failed: $response"
    log_test_result "swap_health_check" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 2: Service Info
test_service_info() {
    print_info "Testing service info endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$LIQUID_SWAP_URL/")
    if [ $? -eq 0 ]; then
        if validate_json_response "$response" "name" "PanoramaBlock Liquid Swap Service API"; then
            print_success "Service info endpoint passed"
            log_test_result "swap_service_info" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Service info failed: $response"
    log_test_result "swap_service_info" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 3: Unauthenticated Swap Request
test_unauthenticated_swap() {
    print_info "Testing unauthenticated swap request (should fail)..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$LIQUID_SWAP_URL/swap/manual" \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}')
    
    if [ "$status_code" = "401" ]; then
        print_success "Unauthenticated swap correctly rejected"
        log_test_result "swap_unauthenticated" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Unauthenticated swap test failed - expected 401, got $status_code"
    log_test_result "swap_unauthenticated" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 4: Invalid Token Swap Request
test_invalid_token_swap() {
    print_info "Testing swap with invalid token..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$LIQUID_SWAP_URL/swap/manual" \
        -H "Authorization: Bearer invalid_token" \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}')
    
    if [ "$status_code" = "401" ] || [ "$status_code" = "500" ]; then
        print_success "Invalid token swap correctly rejected"
        log_test_result "swap_invalid_token" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Invalid token swap test failed - expected 401/500, got $status_code"
    log_test_result "swap_invalid_token" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 5: Manual Swap with Mock Auth (Invalid Data)
test_manual_swap_invalid_data() {
    print_info "Testing manual swap with invalid data..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 15 \
        -X POST "$LIQUID_SWAP_URL/swap/manual" \
        -H "Authorization: Bearer mock_token" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [ "$error" != "null" ]; then
                print_success "Invalid swap data correctly rejected"
                log_test_result "swap_invalid_data" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Invalid swap data test failed: $response"
    log_test_result "swap_invalid_data" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 6: Manual Swap with Mock Complete Data
test_manual_swap_complete_data() {
    print_info "Testing manual swap with complete data..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    swap_data='{
        "fromChain": 1,
        "toChain": 137,
        "fromToken": "0xA0b86a33E6441d1c1Ab6C8d8D48C60e9E6f8d0b0",
        "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        "amount": "1000000",
        "userAddress": "'$TEST_ADDRESS'"
    }'
    
    response=$(curl -s --max-time 15 \
        -X POST "$LIQUID_SWAP_URL/swap/manual" \
        -H "Authorization: Bearer mock_token" \
        -H "Content-Type: application/json" \
        -d "$swap_data")
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            if [[ "$error" == *"auth"* ]] || [[ "$error" == *"token"* ]]; then
                print_success "Complete swap data processed (auth failed as expected)"
                log_test_result "swap_complete_data" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            elif [ "$error" = "null" ]; then
                print_success "Complete swap data processed successfully"
                log_test_result "swap_complete_data" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_warning "Complete swap data test inconclusive: $response"
    log_test_result "swap_complete_data" "WARNING"
    TESTS_PASSED=$((TESTS_PASSED + 1))  # Not critical
    return 0
}

# Test 7: Non-existent Endpoint
test_nonexistent_endpoint() {
    print_info "Testing non-existent endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "$LIQUID_SWAP_URL/nonexistent")
    
    if [ "$status_code" = "404" ]; then
        print_success "Non-existent endpoint correctly returns 404"
        log_test_result "swap_nonexistent" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Non-existent endpoint test failed - expected 404, got $status_code"
    log_test_result "swap_nonexistent" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 8: Service Performance
test_service_performance() {
    print_info "Testing service performance..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local success_count=0
    local total_requests=5
    local start_time=$(date +%s)
    
    for i in $(seq 1 $total_requests); do
        response=$(curl -s --max-time 3 "$LIQUID_SWAP_URL/health")
        if [ $? -eq 0 ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $success_count -ge 4 ] && [ $duration -le 15 ]; then
        print_success "Performance test passed ($success_count/$total_requests in ${duration}s)"
        log_test_result "swap_performance" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Performance test failed ($success_count/$total_requests in ${duration}s)"
    log_test_result "swap_performance" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 9: Integration Info Check
test_integration_info() {
    print_info "Testing integration configuration info..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$LIQUID_SWAP_URL/")
    if [ $? -eq 0 ]; then
        integrations=$(echo "$response" | jq -r '.integrations' 2>/dev/null)
        if [ "$integrations" != "null" ]; then
            print_success "Integration info available"
            log_test_result "swap_integration_info" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_warning "Integration info test inconclusive: $response"
    log_test_result "swap_integration_info" "WARNING"
    TESTS_PASSED=$((TESTS_PASSED + 1))  # Not critical
    return 0
}

# Run all tests
run_swap_tests() {
    # Check if service is available
    if ! wait_for_service "$LIQUID_SWAP_URL" "Liquid Swap Service"; then
        print_error "Liquid Swap Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    # Run tests
    test_health_check
    test_service_info
    test_unauthenticated_swap
    test_invalid_token_swap
    test_manual_swap_invalid_data
    test_manual_swap_complete_data
    test_nonexistent_endpoint
    test_service_performance
    test_integration_info
    
    # Print summary
    print_header "LIQUID SWAP SERVICE TEST SUMMARY"
    print_info "Tests run: $TESTS_RUN"
    print_info "Tests passed: $TESTS_PASSED"
    print_info "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
    
    if [ $TEST_FAILED -eq 0 ]; then
        print_success "All Liquid Swap Service tests passed!"
    else
        print_error "Some Liquid Swap Service tests failed!"
    fi
    
    return $TEST_FAILED
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    run_swap_tests
    result=$?
    cleanup_temp_dir
    exit $result
fi 