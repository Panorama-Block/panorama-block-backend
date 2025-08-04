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

print_header "INTEGRATION E2E TESTS (ALL SERVICES)"

# Test 1: All Services Health Check
test_all_services_health() {
    print_info "Testing all services health checks..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local all_healthy=true
    
    # Check Auth Service
    if ! check_service_health "$AUTH_SERVICE_URL" "Auth Service"; then
        all_healthy=false
    fi
    
    # Check Wallet Tracker Service
    if ! check_service_health "$WALLET_TRACKER_URL" "Wallet Tracker Service"; then
        all_healthy=false
    fi
    
    # Check Liquid Swap Service
    if ! check_service_health "$LIQUID_SWAP_URL" "Liquid Swap Service"; then
        all_healthy=false
    fi
    
    if [ "$all_healthy" = true ]; then
        print_success "All services are healthy"
        log_test_result "integration_all_health" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "Not all services are healthy"
        log_test_result "integration_all_health" "FAILED"
        TEST_FAILED=1
        return 1
    fi
}

# Test 2: Cross-Service Authentication
test_cross_service_auth() {
    print_info "Testing cross-service authentication..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test if wallet tracker service communicates with auth service
    print_info "Testing wallet tracker -> auth service communication..."
    response=$(curl -s --max-time 10 \
        -H "Authorization: Bearer test_token_123" \
        "$WALLET_TRACKER_URL/api/wallets/addresses")
    
    wallet_auth_working=false
    if [ $? -eq 0 ] && validate_json_response "$response"; then
        error=$(echo "$response" | jq -r '.error' 2>/dev/null)
        if [[ "$error" == *"auth"* ]] || [[ "$error" == *"token"* ]] || [[ "$error" == *"unauthorized"* ]]; then
            wallet_auth_working=true
            print_success "Wallet tracker correctly communicates with auth service"
        fi
    fi
    
    # Test if liquid swap service communicates with auth service
    print_info "Testing liquid swap -> auth service communication..."
    response=$(curl -s --max-time 10 \
        -X POST "$LIQUID_SWAP_URL/swap/manual" \
        -H "Authorization: Bearer test_token_123" \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}')
    
    swap_auth_working=false
    if [ $? -eq 0 ] && validate_json_response "$response"; then
        error=$(echo "$response" | jq -r '.error' 2>/dev/null)
        if [[ "$error" == *"auth"* ]] || [[ "$error" == *"token"* ]] || [[ "$error" == *"unauthorized"* ]]; then
            swap_auth_working=true
            print_success "Liquid swap correctly communicates with auth service"
        fi
    fi
    
    if [ "$wallet_auth_working" = true ] && [ "$swap_auth_working" = true ]; then
        print_success "Cross-service authentication working"
        log_test_result "integration_cross_auth" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "Cross-service authentication not working properly"
        log_test_result "integration_cross_auth" "FAILED"
        TEST_FAILED=1
        return 1
    fi
}

# Run all integration tests
run_integration_tests() {
    print_info "Waiting for all services to be ready..."
    
    # Wait for all services
    if ! wait_for_service "$AUTH_SERVICE_URL" "Auth Service"; then
        print_error "Auth Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    if ! wait_for_service "$WALLET_TRACKER_URL" "Wallet Tracker Service"; then
        print_error "Wallet Tracker Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    if ! wait_for_service "$LIQUID_SWAP_URL" "Liquid Swap Service"; then
        print_error "Liquid Swap Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    print_success "All services are ready!"
    
    # Run integration tests
    test_all_services_health
    test_cross_service_auth
    
    # Print summary
    print_header "INTEGRATION TEST SUMMARY"
    print_info "Tests run: $TESTS_RUN"
    print_info "Tests passed: $TESTS_PASSED"
    print_info "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
    
    if [ $TEST_FAILED -eq 0 ]; then
        print_success "All integration tests passed!"
    else
        print_error "Some integration tests failed!"
    fi
    
    return $TEST_FAILED
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    run_integration_tests
    result=$?
    cleanup_temp_dir
    exit $result
fi 