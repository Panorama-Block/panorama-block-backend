#!/bin/bash

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/utils.sh"

print_header "CLEANING UP E2E TEST ENVIRONMENT"

# Stop all services
stop_all_services() {
    print_info "Stopping all services..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Stop Docker Compose services
    if check_docker_compose; then
        print_info "Stopping Docker Compose services..."
        if docker-compose down > /dev/null 2>&1; then
            print_success "Docker Compose services stopped"
        else
            print_warning "Failed to stop some Docker Compose services"
        fi
    else
        print_info "No Docker Compose services running"
    fi
    
    popd > /dev/null
    
    # Kill any remaining processes on ports
    kill_port 3001  # Auth Service
    kill_port 3000  # Wallet Tracker
    kill_port 3002  # Liquid Swap
    kill_port 27017 # MongoDB
    kill_port 6379  # Redis
    
    print_success "All services stopped"
}

# Clean up Docker resources
cleanup_docker_resources() {
    print_info "Cleaning up Docker resources..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Remove containers
    print_info "Removing containers..."
    docker-compose rm -f > /dev/null 2>&1
    
    # Clean up orphaned containers
    print_info "Cleaning up orphaned containers..."
    docker container prune -f > /dev/null 2>&1
    
    # Clean up unused images (optional)
    if [ "$1" = "--deep" ]; then
        print_info "Performing deep cleanup (removing unused images)..."
        docker image prune -f > /dev/null 2>&1
    fi
    
    # Clean up networks
    print_info "Cleaning up networks..."
    docker network prune -f > /dev/null 2>&1
    
    popd > /dev/null
    
    print_success "Docker resources cleaned up"
}

# Clean up volumes (optional)
cleanup_volumes() {
    print_info "Cleaning up Docker volumes..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    if [ "$1" = "--volumes" ] || [ "$1" = "--deep" ]; then
        print_warning "Removing Docker volumes (this will delete all data)..."
        docker-compose down -v > /dev/null 2>&1
        docker volume prune -f > /dev/null 2>&1
        print_success "Docker volumes cleaned up"
    else
        print_info "Skipping volume cleanup (use --volumes to clean volumes)"
    fi
    
    popd > /dev/null
}

# Clean up temporary test files
cleanup_temp_files() {
    print_info "Cleaning up temporary test files..."
    
    cleanup_temp_dir
    
    # Clean up any additional test artifacts
    rm -f /tmp/panorama-*.log 2>/dev/null
    rm -f /tmp/test-*.json 2>/dev/null
    
    print_success "Temporary files cleaned up"
}

# Clean up log files
cleanup_logs() {
    print_info "Cleaning up log files..."
    
    pushd "$PROJECT_ROOT" > /dev/null
    
    # Remove Docker Compose logs
    docker-compose logs --no-color > /dev/null 2>&1 || true
    
    popd > /dev/null
    
    print_success "Log files cleaned up"
}

# Show resource usage after cleanup
show_resource_usage() {
    print_info "Current resource usage:"
    
    # Show running containers
    local running_containers=$(docker ps -q | wc -l)
    print_info "Running containers: $running_containers"
    
    # Show Docker images
    local total_images=$(docker images -q | wc -l)
    print_info "Docker images: $total_images"
    
    # Show Docker volumes
    local total_volumes=$(docker volume ls -q | wc -l)
    print_info "Docker volumes: $total_volumes"
    
    # Show disk usage
    if command -v df >/dev/null 2>&1; then
        local disk_usage=$(df -h / | awk 'NR==2 {print $5}')
        print_info "Disk usage: $disk_usage"
    fi
}

# Main cleanup function
main_cleanup() {
    local cleanup_mode="$1"
    
    case "$cleanup_mode" in
        "--deep")
            print_info "Performing deep cleanup..."
            stop_all_services
            cleanup_docker_resources "--deep"
            cleanup_volumes "--deep"
            cleanup_temp_files
            cleanup_logs
            ;;
        "--volumes")
            print_info "Performing cleanup with volume removal..."
            stop_all_services
            cleanup_docker_resources
            cleanup_volumes "--volumes"
            cleanup_temp_files
            cleanup_logs
            ;;
        *)
            print_info "Performing standard cleanup..."
            stop_all_services
            cleanup_docker_resources
            cleanup_volumes
            cleanup_temp_files
            cleanup_logs
            ;;
    esac
    
    show_resource_usage
    
    print_header "CLEANUP COMPLETED"
    print_success "E2E test environment cleaned up successfully!"
    
    if [ "$cleanup_mode" != "--deep" ] && [ "$cleanup_mode" != "--volumes" ]; then
        print_info ""
        print_info "Cleanup options:"
        print_info "  ./cleanup.sh --volumes    - Also remove Docker volumes (deletes data)"
        print_info "  ./cleanup.sh --deep       - Deep cleanup (removes images and volumes)"
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Clean up the E2E test environment"
    echo ""
    echo "OPTIONS:"
    echo "  --help              Show this help message"
    echo "  --volumes           Also remove Docker volumes (deletes all data)"
    echo "  --deep              Deep cleanup: remove images, volumes, and all resources"
    echo ""
    echo "Examples:"
    echo "  $0                  Standard cleanup (keeps volumes and images)"
    echo "  $0 --volumes        Cleanup and remove volumes"
    echo "  $0 --deep           Complete cleanup (removes everything)"
}

# Main execution
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    case "$1" in
        "--help" | "-h")
            show_help
            exit 0
            ;;
        *)
            main_cleanup "$1"
            exit $?
            ;;
    esac
fi 