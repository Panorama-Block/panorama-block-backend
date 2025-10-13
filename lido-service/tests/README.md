# Lido Service API Tests

This directory contains comprehensive test suites for the Lido Service API.

## Test Scripts

### 1. `quick-test.sh` - Quick API Test
Simple bash script for fast testing of main endpoints.

```bash
./tests/quick-test.sh
```

**What it tests:**
- Health check
- User login
- Protected endpoints (stake)
- Position query
- Protocol info

### 2. `test-lido-api.sh` - Comprehensive Bash Test Suite
Full-featured bash test suite with detailed reporting.

```bash
./tests/test-lido-api.sh
```

**What it tests:**
- Health check
- Authentication (login, verify, refresh, logout)
- Staking operations (stake, unstake, claim rewards)
- Public endpoints (protocol info, position, history)
- Error cases (invalid inputs, unauthorized access)
- Performance (concurrent requests)
- Token expiration handling

### 3. `test-lido-api.js` - Node.js Test Suite
Advanced JavaScript test suite with proper error handling.

```bash
node tests/test-lido-api.js
```

**Features:**
- Async/await testing
- Proper error handling
- Detailed reporting
- Performance testing
- Token management
- Concurrent request testing

## Prerequisites

### For Bash Scripts
- `curl` - HTTP client
- `jq` - JSON processor
- API running on `http://localhost:3004`

### For Node.js Script
- Node.js
- `axios` - HTTP client
- API running on `http://localhost:3004`

Install dependencies:
```bash
npm install axios
```

## Running Tests

### Quick Test (Recommended for development)
```bash
./tests/quick-test.sh
```

### Full Test Suite
```bash
./tests/test-lido-api.sh
```

### Node.js Test Suite
```bash
node tests/test-lido-api.js
```

## Test Configuration

### Default Settings
- **API URL**: `http://localhost:3004`
- **Test User**: `0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6`
- **Test Amount**: `1.0 ETH`

### Customizing Tests
You can modify the test scripts to use different:
- API URLs
- Test user addresses
- Test amounts
- Timeout values

## Expected Results

### Successful Test Run
```
🚀 Lido Service API Test Suite
================================
✅ Health Check
✅ User Login
✅ Token Verification
✅ Stake ETH
✅ Get Position
✅ Protocol Info
📊 Test Results Summary
Total tests: 6
Passed: 6
Failed: 0
🎉 All tests passed! API is working correctly.
```

### Failed Test Run
```
❌ Some tests failed. Please check the API implementation.
```

## Troubleshooting

### API Not Running
```
❌ API is not running or not responding
Please start the API with: npm run dev
```

**Solution:**
```bash
cd lido-service
npm run dev
```

### Connection Refused
```
curl: (7) Failed to connect to localhost port 3004
```

**Solution:**
1. Check if API is running: `ps aux | grep node`
2. Check if port 3004 is available: `netstat -tlnp | grep 3004`
3. Restart the API: `npm run dev`

### Authentication Failures
```
❌ Login failed
❌ Failed to get access token
```

**Solution:**
1. Check JWT configuration in `.env`
2. Verify API is properly initialized
3. Check logs for authentication errors

## Test Coverage

### Endpoints Tested
- `GET /health` - Health check
- `POST /api/lido/auth/login` - User login
- `GET /api/lido/auth/verify` - Token verification
- `POST /api/lido/auth/refresh` - Token refresh
- `POST /api/lido/auth/logout` - User logout
- `POST /api/lido/stake` - Stake ETH
- `POST /api/lido/unstake` - Unstake stETH
- `POST /api/lido/claim-rewards` - Claim rewards
- `GET /api/lido/position/:userAddress` - Get position
- `GET /api/lido/history/:userAddress` - Get history
- `GET /api/lido/protocol/info` - Protocol information

### Error Cases Tested
- Invalid user addresses
- Missing authentication
- Invalid tokens
- Malformed requests
- Non-existent endpoints

### Performance Tests
- Concurrent request handling
- Response time measurement
- Load testing with multiple requests

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test Lido Service API
  run: |
    cd lido-service
    npm run dev &
    sleep 10
    ./tests/test-lido-api.sh
```

## Contributing

When adding new endpoints or features:
1. Update the test scripts
2. Add new test cases
3. Update this README
4. Ensure all tests pass

## Support

For issues with the test suite:
1. Check API logs
2. Verify environment variables
3. Ensure all dependencies are installed
4. Check network connectivity
