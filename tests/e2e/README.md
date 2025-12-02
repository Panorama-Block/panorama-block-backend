# PanoramaBlock E2E Test Suite

This directory contains a complete automated end-to-end (E2E) test suite for validating the microservices architecture in the PanoramaBlock backend.

## 🏗️ Architecture Tested

This test suite validates a complete microservices architecture with:

### Infrastructure Services
- **MongoDB** (port 27017): Document database for storing transaction data
- **Redis** (port 6379): Cache and session management

### Application Services
- **Auth Service** (port 3301): ThirdWeb authentication service for all platform services
- **Wallet Tracker Service** (port 3000): Go service with Rango API integration, depends on auth service
- **Liquid Swap Service** (port 3302): ThirdWeb SDK swap service, receives authentication from auth service

## 📁 Test Suite Structure

```
tests/e2e/
├── run-all-tests.sh           # Main test runner script
├── setup.sh                   # Environment setup and service initialization
├── cleanup.sh                 # Environment cleanup and teardown
├── utils.sh                   # Shared utilities and helper functions
├── test-auth-service.sh       # Auth Service specific tests
├── test-wallet-tracker.sh     # Wallet Tracker Service tests
├── test-liquid-swap.sh        # Liquid Swap Service tests
├── test-integration.sh        # Cross-service integration tests
└── README.md                  # This documentation
```

## 🚀 Usage

### Complete Test Suite
```bash
# Run all tests with default configuration
./run-all-tests.sh

# Run tests with verbose output
./run-all-tests.sh --verbose

# Run tests without initial setup (if services are already running)
./run-all-tests.sh --no-setup

# Stop on first failure
./run-all-tests.sh --stop-on-failure

# Skip cleanup after tests (useful for debugging)
./run-all-tests.sh --no-cleanup
```

### Individual Service Tests
```bash
# Test only the Auth Service
./test-auth-service.sh

# Test only the Wallet Tracker Service
./test-wallet-tracker.sh

# Test only the Liquid Swap Service
./test-liquid-swap.sh

# Test only cross-service integration
./test-integration.sh
```

### Environment Management
```bash
# Setup test environment only (no tests)
./setup.sh

# Cleanup test environment only
./cleanup.sh

# Deep cleanup (remove volumes and images)
./cleanup.sh --deep
```

## 📋 Prerequisites

### Required Tools
- **Docker**: For containerization
- **Docker Compose**: For orchestrating services
- **curl**: For HTTP requests
- **jq**: For JSON processing
- **bash**: Shell environment (version 4.0+)

### Environment Configuration
Ensure you have a `.env` file in the project root with:

```bash
# Service Ports
WALLET_TRACKER_PORT=3000
AUTH_PORT=3301
LIQUID_SWAP_PORT=3302

# Database Configuration
MONGO_DB_NAME=rango
MONGO_URI=mongodb://admin:password@mongodb:27017/rango?authSource=admin
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password
MONGO_INITDB_ROOT_DATABASE=rango

# Cache Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASS=your-redis-password

# Authentication
AUTH_PRIVATE_KEY=your-auth-private-key
AUTH_DOMAIN=localhost:3301

# External Services
X_RANGO_ID=your-rango-api-key
THIRDWEB_CLIENT_ID=your-thirdweb-client-id

# Additional configuration variables...
```

## 🧪 Test Categories

### 1. Auth Service Tests (`test-auth-service.sh`)
- **Health Check**: Service availability and basic endpoint response
- **Login Payload Generation**: ThirdWeb authentication payload creation
- **Token Validation**: JWT token verification and validation
- **Authentication Flow**: Complete login/logout cycle
- **Error Handling**: Invalid requests and error responses
- **Rate Limiting**: API rate limiting validation

### 2. Wallet Tracker Tests (`test-wallet-tracker.sh`)
- **Health Check**: Service availability
- **Authentication Protection**: Unauthenticated request rejection
- **Rango API Integration**: External API connectivity

### 3. Liquid Swap Tests (`test-liquid-swap.sh`)
- **Health Check**: Service availability
- **Authentication Middleware**: Token validation via auth service
- **Swap Endpoints**: ThirdWeb SDK functionality
- **Performance Testing**: Response time validation

### 4. Integration Tests (`test-integration.sh`)
- **Cross-Service Communication**: Service-to-service authentication
- **End-to-End Flows**: Complete user journeys
- **Service Dependencies**: Proper dependency resolution
- **Load Testing**: Multiple concurrent requests

## 📊 Test Results

### Output Format
Tests provide color-coded output:
- 🟢 **Green**: Successful tests
- 🔴 **Red**: Failed tests
- 🟡 **Yellow**: Warnings or skipped tests
- 🔵 **Blue**: Informational messages

### Result Files
Test results are saved in `/tmp/panorama-e2e-tests/` with:
- **Individual test logs**: Detailed output for each test
- **Summary reports**: Consolidated test results
- **Error logs**: Detailed error information for failed tests
- **Performance metrics**: Response time measurements

## 🐛 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker Compose logs
docker-compose logs

# Check individual service logs
docker-compose logs auth_service
docker-compose logs wallet_tracker_service
docker-compose logs liquid_swap_service
```

#### Port Conflicts
```bash
# Check which processes are using ports
sudo netstat -tulpn | grep :3301
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3302

# Kill processes on specific ports
sudo kill $(sudo lsof -t -i:3301)
```

#### Environment Variable Issues
```bash
# Validate .env file
source .env && env | grep -E "(MONGO|REDIS|AUTH|THIRDWEB)"

# Check Docker Compose variable substitution
docker-compose config
```

#### Database Connection Issues
```bash
# Test MongoDB connection
docker exec -it panorama-mongodb mongosh --eval "db.adminCommand('ping')"

# Test Redis connection
docker exec -it panorama-redis redis-cli ping
```

### Debug Mode
Enable debug mode by setting:
```bash
DEBUG=true
```

This provides:
- Detailed request/response logging
- Service startup information
- Database connection details
- Authentication flow debugging

### Manual Testing
For manual verification:

```bash
# Check service health
curl http://localhost:3301/health
curl http://localhost:3000/health
curl http://localhost:3302/health

# Test authentication flow
curl -X POST http://localhost:3301/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0x1234..."}'
```

## 🔧 Advanced Configuration

### Custom Test Timeouts
Set custom timeouts in individual test scripts:
```bash
TIMEOUT=30  # seconds
```

### Custom Service URLs
Override default service URLs:
```bash
export AUTH_SERVICE_URL="http://localhost:3301"
export WALLET_TRACKER_URL="http://localhost:3000"
export LIQUID_SWAP_URL="http://localhost:3302"
```

### Test Data Management
Tests use temporary directories for:
- Mock authentication data
- Test result storage
- Service logs and outputs

Cleanup is automatic unless `--no-cleanup` is specified.

## 📈 Performance Expectations

### Response Time Targets
- **Auth Service**: < 200ms for token operations
- **Wallet Tracker**: < 500ms for API calls
- **Liquid Swap**: < 1000ms for swap operations

### Concurrent Load Testing
Integration tests validate:
- 10 concurrent authentication requests
- 5 concurrent swap operations
- Cross-service communication under load

## 🤝 Contributing

When adding new tests:
1. Follow the existing naming convention
2. Use the shared utilities from `utils.sh`
3. Add appropriate error handling
4. Include performance validation
5. Update this documentation

## 📄 License

This test suite is part of the PanoramaBlock project and follows the same licensing terms. 