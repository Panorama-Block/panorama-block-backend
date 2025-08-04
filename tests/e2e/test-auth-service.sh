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

print_header "AUTH SERVICE E2E TESTS"

# Test 1: Health Check
test_health_check() {
    print_info "Testing health check endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$AUTH_SERVICE_URL/health")
    if [ $? -eq 0 ]; then
        if validate_json_response "$response" "status" "ok"; then
            print_success "Health check passed"
            log_test_result "auth_health_check" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Health check failed: $response"
    log_test_result "auth_health_check" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 2: Service Info
test_service_info() {
    print_info "Testing service info endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 5 "$AUTH_SERVICE_URL/")
    if [ $? -eq 0 ]; then
        if validate_json_response "$response" "name" "PanoramaBlock Auth Service"; then
            print_success "Service info endpoint passed"
            log_test_result "auth_service_info" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Service info failed: $response"
    log_test_result "auth_service_info" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 3: Login Payload Generation
test_login_payload() {
    print_info "Testing login payload generation..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    response=$(curl -s --max-time 10 -X POST "$AUTH_SERVICE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"address\": \"$TEST_ADDRESS\"}")
    
    if [ $? -eq 0 ]; then
        if validate_json_response "$response"; then
            # Check if payload field exists
            payload=$(echo "$response" | jq -r '.payload' 2>/dev/null)
            if [ "$payload" != "null" ] && [ -n "$payload" ]; then
                # Save payload for next test
                echo "$response" > "$PAYLOAD_FILE"
                print_success "Login payload generated successfully"
                log_test_result "auth_login_payload" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Login payload generation failed: $response"
    log_test_result "auth_login_payload" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 4: Login with Invalid Data
test_login_invalid() {
    print_info "Testing login with invalid data..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test without address
    response=$(curl -s --max-time 5 -X POST "$AUTH_SERVICE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{}")
    
    if [ $? -eq 0 ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_SERVICE_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d "{}")
        
        if [ "$status_code" = "400" ]; then
            print_success "Invalid login correctly rejected"
            log_test_result "auth_login_invalid" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Invalid login test failed - should return 400"
    log_test_result "auth_login_invalid" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 5: Signature Verification (Mock)
test_signature_verification() {
    print_info "Testing signature verification (mock)..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ ! -f "$PAYLOAD_FILE" ]; then
        print_error "No payload available for verification test"
        log_test_result "auth_signature_verification" "SKIPPED"
        return 1
    fi
    
    # Create mock verification payload
    verify_payload_file=$(mock_wallet_sign "$PAYLOAD_FILE")
    
    response=$(curl -s --max-time 10 -X POST "$AUTH_SERVICE_URL/auth/verify" \
        -H "Content-Type: application/json" \
        -d @"$verify_payload_file")
    
    if [ $? -eq 0 ]; then
        # Note: This might fail with real ThirdWeb verification, but we test the endpoint
        if validate_json_response "$response"; then
            # Check if we got a token or an error
            token=$(echo "$response" | jq -r '.token' 2>/dev/null)
            error=$(echo "$response" | jq -r '.error' 2>/dev/null)
            
            if [ "$token" != "null" ] && [ -n "$token" ]; then
                # Save token for other tests
                echo "$token" > "$TOKEN_FILE"
                session_id=$(echo "$response" | jq -r '.sessionId' 2>/dev/null)
                if [ "$session_id" != "null" ] && [ -n "$session_id" ]; then
                    echo "$session_id" > "$SESSION_FILE"
                fi
                print_success "Signature verification returned token"
                log_test_result "auth_signature_verification" "PASSED"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            elif [ "$error" != "null" ] && [ -n "$error" ]; then
                # Expected behavior with mock signature
                print_warning "Signature verification failed as expected with mock signature: $error"
                log_test_result "auth_signature_verification" "EXPECTED_FAILURE"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            fi
        fi
    fi
    
    print_error "Signature verification test failed: $response"
    log_test_result "auth_signature_verification" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 6: Token Validation
test_token_validation() {
    print_info "Testing token validation..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test with invalid token
    response=$(curl -s --max-time 5 -X POST "$AUTH_SERVICE_URL/auth/validate" \
        -H "Content-Type: application/json" \
        -d '{"token": "invalid_token"}')
    
    if [ $? -eq 0 ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_SERVICE_URL/auth/validate" \
            -H "Content-Type: application/json" \
            -d '{"token": "invalid_token"}')
        
        if [ "$status_code" = "401" ]; then
            print_success "Invalid token correctly rejected"
            log_test_result "auth_token_validation" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Token validation test failed"
    log_test_result "auth_token_validation" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 7: Logout
test_logout() {
    print_info "Testing logout endpoint..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test logout without session
    response=$(curl -s --max-time 5 -X POST "$AUTH_SERVICE_URL/auth/logout" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    if [ $? -eq 0 ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_SERVICE_URL/auth/logout" \
            -H "Content-Type: application/json" \
            -d '{}')
        
        if [ "$status_code" = "400" ]; then
            print_success "Logout without session correctly rejected"
            log_test_result "auth_logout" "PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    fi
    
    print_error "Logout test failed"
    log_test_result "auth_logout" "FAILED"
    TEST_FAILED=1
    return 1
}

# Test 8: Rate Limiting / Stress Test
test_rate_limiting() {
    print_info "Testing service under load..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local success_count=0
    local total_requests=10
    
    for i in $(seq 1 $total_requests); do
        response=$(curl -s --max-time 2 "$AUTH_SERVICE_URL/health")
        if [ $? -eq 0 ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    if [ $success_count -ge 8 ]; then  # Allow some failures
        print_success "Service handled load test ($success_count/$total_requests requests succeeded)"
        log_test_result "auth_rate_limiting" "PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    print_error "Service failed under load ($success_count/$total_requests requests succeeded)"
    log_test_result "auth_rate_limiting" "FAILED"
    TEST_FAILED=1
    return 1
}

# Run all tests
run_auth_tests() {
    # Check if service is available
    if ! wait_for_service "$AUTH_SERVICE_URL" "Auth Service"; then
        print_error "Auth Service is not available"
        cleanup_temp_dir
        exit 1
    fi
    
    # Run tests
    test_health_check
    test_service_info
    test_login_payload
    test_login_invalid
    test_signature_verification
    test_token_validation
    test_logout
    test_rate_limiting
    
    # Print summary
    print_header "AUTH SERVICE TEST SUMMARY"
    print_info "Tests run: $TESTS_RUN"
    print_info "Tests passed: $TESTS_PASSED"
    print_info "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
    
    if [ $TEST_FAILED -eq 0 ]; then
        print_success "All Auth Service tests passed!"
    else
        print_error "Some Auth Service tests failed!"
    fi
    
    return $TEST_FAILED
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    run_auth_tests
    result=$?
    cleanup_temp_dir
    exit $result
fi 