#!/bin/bash

# PanoramaBlock E2E Test Suite - Main Test Runner
# This script orchestrates the complete end-to-end testing process

# Set strict error handling
set -e

# Get script directory for relative imports
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Default configuration
SETUP=true
CLEANUP=true
STOP_ON_FAILURE=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-setup)
            SETUP=false
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --stop-on-failure)
            STOP_ON_FAILURE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            cat << EOF
PanoramaBlock E2E Test Suite

Usage: $0 [OPTIONS]

OPTIONS:
    --no-setup         Skip environment setup (assume services are running)
    --no-cleanup       Skip cleanup after tests (useful for debugging)
    --stop-on-failure  Stop execution on first test failure
    --verbose          Enable verbose output and detailed logging
    --help             Show this help message

EXAMPLES:
    $0                          # Run complete test suite
    $0 --verbose                # Run with detailed output
    $0 --no-setup --no-cleanup  # Run tests only (no setup/cleanup)
    $0 --stop-on-failure        # Stop on first failure

ENVIRONMENT:
    Ensure you have a .env file in the project root with required variables.
    See README.md for complete configuration details.
EOF
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_info "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Enable verbose mode if requested
if [ "$VERBOSE" = "true" ]; then
    set -x
    export DEBUG=true
fi

# Print test configuration
print_header "PANORAMABLOCK E2E TEST SUITE"
print_info "Test Configuration:"
print_info "  Setup: $SETUP"
print_info "  Cleanup: $CLEANUP"
print_info "  Stop on failure: $STOP_ON_FAILURE"
print_info "  Verbose: $VERBOSE"
print_info ""

# Initialize test environment
init_temp_dir

# Setup phase
if [ "$SETUP" = "true" ]; then
    print_header "SETTING UP TEST ENVIRONMENT"
    if ! "$SCRIPT_DIR/setup.sh"; then
        print_error "Failed to setup test environment"
        cleanup_temp_dir
        exit 1
    fi
    print_info ""
fi

# Test execution phase
OVERALL_SUCCESS=true

# Function to run individual test script
run_test_script() {
    local script_name="$1"
    local script_path="$SCRIPT_DIR/$script_name"
    
    print_header "RUNNING $script_name"
    
    if [ ! -f "$script_path" ]; then
        print_error "Test script not found: $script_path"
        return 1
    fi
    
    if ! "$script_path"; then
        print_error "$script_name failed"
        if [ "$STOP_ON_FAILURE" = "true" ]; then
            print_error "Stopping execution due to --stop-on-failure flag"
            exit 1
        fi
        return 1
    else
        print_success "$script_name completed successfully"
        return 0
    fi
}

# Run Auth Service tests
if ! run_test_script "test-auth-service.sh"; then
    OVERALL_SUCCESS=false
fi

print_info ""

# Run Wallet Tracker tests
if ! run_test_script "test-wallet-tracker.sh"; then
    OVERALL_SUCCESS=false
fi

print_info ""

# Run Liquid Swap tests
if ! run_test_script "test-liquid-swap.sh"; then
    OVERALL_SUCCESS=false
fi

print_info ""

# Run Integration tests
if ! run_test_script "test-integration.sh"; then
    OVERALL_SUCCESS=false
fi

print_info ""

# Generate final report
print_header "TEST SUITE RESULTS"

if [ "$OVERALL_SUCCESS" = "true" ]; then
    print_success "All test suites completed successfully!"
    print_info "Total tests run: $TESTS_RUN"
    print_info "Total tests passed: $TESTS_PASSED"
    print_info "Success rate: 100%"
else
    print_error "Some test suites failed"
    print_info "Total tests run: $TESTS_RUN"
    print_info "Total tests passed: $TESTS_PASSED"
    if [ $TESTS_RUN -gt 0 ]; then
        local success_rate=$(( TESTS_PASSED * 100 / TESTS_RUN ))
        print_info "Success rate: ${success_rate}%"
    fi
fi

# Save comprehensive test results
save_test_results "Complete E2E Test Suite"

# Service status information
print_info ""
print_info "Service Status:"
print_info "  Auth Service: $AUTH_SERVICE_URL"
print_info "  Wallet Tracker: $WALLET_TRACKER_URL"
print_info "  Liquid Swap: $LIQUID_SWAP_URL"

# Cleanup phase
if [ "$CLEANUP" = "true" ]; then
    print_info ""
    print_header "CLEANING UP TEST ENVIRONMENT"
    "$SCRIPT_DIR/cleanup.sh"
else
    print_info ""
    print_warning "Skipping cleanup (--no-cleanup flag set)"
    print_info "Services are still running. Use './cleanup.sh' to stop them."
fi

# Cleanup temporary files
cleanup_temp_dir

# Final status
print_info ""
if [ "$OVERALL_SUCCESS" = "true" ]; then
    print_header "🎉 E2E TEST SUITE COMPLETED SUCCESSFULLY"
    exit 0
else
    print_header "❌ E2E TEST SUITE COMPLETED WITH FAILURES"
    exit 1
fi 