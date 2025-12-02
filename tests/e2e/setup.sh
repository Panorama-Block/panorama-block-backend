#!/bin/bash

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/utils.sh"

print_header "SETTING UP E2E TEST ENVIRONMENT"

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if required tools are installed
    local missing_tools=()
    
    if ! command -v curl >/dev/null 2>&1; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing_tools+=("jq")
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        missing_tools+=("docker")
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        missing_tools+=("docker-compose")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install missing tools and try again"
        return 1
    fi
    
    print_success "All prerequisites are available"
    return 0
}

# Check if .env file exists
check_env_file() {
    print_info "Checking .env file..."
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        print_error ".env file not found in project root: $PROJECT_ROOT"
        print_info "Please create .env file with required variables"
        return 1
    fi
    
    # Check if essential variables are set
    source "$PROJECT_ROOT/.env"
    
    local missing_vars=()
    
    if [ -z "$AUTH_PRIVATE_KEY" ]; then
        missing_vars+=("AUTH_PRIVATE_KEY")
    fi
    
    if [ -z "$MONGO_INITDB_ROOT_PASSWORD" ]; then
        missing_vars+=("MONGO_INITDB_ROOT_PASSWORD")
    fi
    
    if [ -z "$REDIS_PASS" ]; then
        missing_vars+=("REDIS_PASS")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    print_success ".env file is properly configured"
    return 0
}

# Stop any running services
stop_existing_services() {
    print_info "Stopping any existing services..."
    
    # Stop Docker Compose services
    pushd "$PROJECT_ROOT" > /dev/null
    if check_docker_compose; then
        print_info "Stopping Docker Compose services..."
        docker-compose down > /dev/null 2>&1
    fi
    popd > /dev/null
    
    # Kill any processes on the ports we need
    kill_port 3301  # Auth Service
    kill_port 3000  # Wallet Tracker
    kill_port 3302  # Liquid Swap
    
    print_success "Existing services stopped"
}

# Build services
build_services() {
    print_info "Building services..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Build with docker-compose, capturing output to check for actual errors
    local build_output=$(docker-compose build 2>&1)
    local build_exit_code=$?
    
    popd > /dev/null
    
    # Check if build actually succeeded (ignore deprecation warnings)
    if [ $build_exit_code -eq 0 ] && echo "$build_output" | grep -q "Successfully built\|Successfully tagged"; then
        print_success "Services built successfully"
        return 0
    else
        print_error "Failed to build services"
        if [ "$DEBUG" = "true" ]; then
            print_info "Build output:"
            echo "$build_output" | sed 's/^/  /'
        fi
        return 1
    fi
}

# Start infrastructure services first
start_infrastructure() {
    print_info "Starting infrastructure services (MongoDB, Redis)..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Start only infrastructure services first
    local start_output=$(docker-compose up -d mongodb redis 2>&1)
    local start_exit_code=$?
    
    popd > /dev/null
    
    if [ $start_exit_code -eq 0 ]; then
        print_success "Infrastructure services started"
        
        # Wait for them to be ready
        print_info "Waiting for infrastructure to be ready..."
        sleep 10
        
        return 0
    else
        print_error "Failed to start infrastructure services"
        if [ "$DEBUG" = "true" ]; then
            print_info "Start output:"
            echo "$start_output" | sed 's/^/  /'
        fi
        return 1
    fi
}

# Start application services
start_services() {
    print_info "Starting application services..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Start all services
    local start_output=$(docker-compose up -d 2>&1)
    local start_exit_code=$?
    
    popd > /dev/null
    
    if [ $start_exit_code -eq 0 ]; then
        print_success "All services started"
        
        # Wait for services to be ready
        print_info "Waiting for services to initialize..."
        sleep 15
        
        return 0
    else
        print_error "Failed to start services"
        if [ "$DEBUG" = "true" ]; then
            print_info "Start output:"
            echo "$start_output" | sed 's/^/  /'
        fi
        return 1
    fi
}

# Verify services are running
verify_services() {
    print_info "Verifying services are running..."
    
    # Wait for each service to be ready
    if wait_for_service "$AUTH_SERVICE_URL" "Auth Service"; then
        print_success "Auth Service is ready"
    else
        print_error "Auth Service failed to start"
        return 1
    fi
    
    if wait_for_service "$WALLET_TRACKER_URL" "Wallet Tracker Service"; then
        print_success "Wallet Tracker Service is ready"
    else
        print_error "Wallet Tracker Service failed to start"
        return 1
    fi
    
    if wait_for_service "$LIQUID_SWAP_URL" "Liquid Swap Service"; then
        print_success "Liquid Swap Service is ready"
    else
        print_error "Liquid Swap Service failed to start"
        return 1
    fi
    
    print_success "All services are running and ready"
    return 0
}

# Main setup function
setup_environment() {
    init_temp_dir
    
    if ! check_prerequisites; then
        cleanup_temp_dir
        exit 1
    fi
    
    if ! check_env_file; then
        cleanup_temp_dir
        exit 1
    fi
    
    stop_existing_services
    
    if ! build_services; then
        cleanup_temp_dir
        exit 1
    fi
    
    if ! start_infrastructure; then
        cleanup_temp_dir
        exit 1
    fi
    
    if ! start_services; then
        cleanup_temp_dir
        exit 1
    fi
    
    if ! verify_services; then
        cleanup_temp_dir
        exit 1
    fi
    
    print_header "E2E TEST ENVIRONMENT READY"
    print_success "All services are running and ready for testing!"
    print_info "You can now run individual tests or the full test suite"
    print_info ""
    print_info "Available test commands:"
    print_info "  ./test-auth-service.sh        - Test Auth Service only"
    print_info "  ./test-wallet-tracker.sh      - Test Wallet Tracker only"
    print_info "  ./test-liquid-swap.sh         - Test Liquid Swap only"
    print_info "  ./test-integration.sh         - Test all services together"
    print_info "  ./run-all-tests.sh            - Run complete test suite"
    
    return 0
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    setup_environment
    exit $?
fi 