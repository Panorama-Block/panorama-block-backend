#!/usr/bin/env node

/**
 * Lido Service API Test Suite (Node.js)
 * Comprehensive testing with proper error handling and reporting
 */

const axios = require('axios');

class LidoAPITester {
    constructor(baseUrl = 'http://localhost:3004') {
        this.baseUrl = baseUrl;
        this.apiBase = `${baseUrl}/api/lido`;
        this.authBase = `${this.apiBase}/auth`;
        this.testUser = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
        this.testAmount = '1.0';
        
        this.accessToken = null;
        this.refreshToken = null;
        
        this.testsPassed = 0;
        this.testsFailed = 0;
        this.totalTests = 0;
    }

    // Helper methods
    log(message, type = 'info') {
        const colors = {
            info: '\x1b[34m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            reset: '\x1b[0m'
        };
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        
        console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
    }

    async makeRequest(method, url, data = null, headers = {}) {
        try {
            const config = {
                method,
                url,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            
            if (data) {
                config.data = data;
            }
            
            const response = await axios(config);
            return { success: true, data: response.data, status: response.status };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message,
                status: error.response?.status || 500
            };
        }
    }

    async runTest(testName, testFunction) {
        this.totalTests++;
        this.log(`Testing: ${testName}`, 'info');
        
        try {
            const result = await testFunction();
            if (result) {
                this.testsPassed++;
                this.log(`PASSED: ${testName}`, 'success');
            } else {
                this.testsFailed++;
                this.log(`FAILED: ${testName}`, 'error');
            }
            return result;
        } catch (error) {
            this.testsFailed++;
            this.log(`ERROR: ${testName} - ${error.message}`, 'error');
            return false;
        }
    }

    // Test methods
    async testHealthCheck() {
        return this.runTest('Health Check', async () => {
            const result = await this.makeRequest('GET', `${this.baseUrl}/health`);
            return result.success && result.status === 200;
        });
    }

    async testLogin() {
        return this.runTest('User Login', async () => {
            const result = await this.makeRequest('POST', `${this.authBase}/login`, {
                userAddress: this.testUser
            });
            
            if (result.success && result.data.success) {
                this.accessToken = result.data.data.accessToken;
                this.refreshToken = result.data.data.refreshToken;
                this.log(`Access Token: ${this.accessToken.substring(0, 50)}...`, 'info');
                return true;
            }
            return false;
        });
    }

    async testTokenVerification() {
        return this.runTest('Token Verification', async () => {
            if (!this.accessToken) {
                this.log('No access token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('GET', `${this.authBase}/verify`, null, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            return result.success && result.status === 200;
        });
    }

    async testTokenRefresh() {
        return this.runTest('Token Refresh', async () => {
            if (!this.refreshToken) {
                this.log('No refresh token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('POST', `${this.authBase}/refresh`, {
                refreshToken: this.refreshToken
            });
            
            if (result.success && result.data.success) {
                this.accessToken = result.data.data.accessToken;
                this.log('Token refreshed successfully', 'success');
                return true;
            }
            return false;
        });
    }

    async testStake() {
        return this.runTest('Stake ETH', async () => {
            if (!this.accessToken) {
                this.log('No access token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('POST', `${this.apiBase}/stake`, {
                userAddress: this.testUser,
                amount: this.testAmount
            }, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            return result.success && result.status === 200;
        });
    }

    async testUnstake() {
        return this.runTest('Unstake stETH', async () => {
            if (!this.accessToken) {
                this.log('No access token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('POST', `${this.apiBase}/unstake`, {
                userAddress: this.testUser,
                amount: this.testAmount
            }, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            return result.success && result.status === 200;
        });
    }

    async testClaimRewards() {
        return this.runTest('Claim Rewards', async () => {
            if (!this.accessToken) {
                this.log('No access token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('POST', `${this.apiBase}/claim-rewards`, {
                userAddress: this.testUser
            }, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            return result.success && result.status === 200;
        });
    }

    async testGetPosition() {
        return this.runTest('Get Position', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/position/${this.testUser}`);
            return result.success && result.status === 200;
        });
    }

    async testGetStakingHistory() {
        return this.runTest('Get Staking History', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/history/${this.testUser}?limit=10`);
            return result.success && result.status === 200;
        });
    }

    async testGetProtocolInfo() {
        return this.runTest('Get Protocol Info', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/protocol/info`);
            return result.success && result.status === 200;
        });
    }

    async testErrorCases() {
        return this.runTest('Error Cases', async () => {
            // Test invalid login
            const invalidLogin = await this.makeRequest('POST', `${this.authBase}/login`, {
                userAddress: 'invalid_address'
            });
            
            // Test stake without auth
            const unauthorizedStake = await this.makeRequest('POST', `${this.apiBase}/stake`, {
                userAddress: this.testUser,
                amount: this.testAmount
            });
            
            // Test invalid token
            const invalidToken = await this.makeRequest('GET', `${this.authBase}/verify`, null, {
                'Authorization': 'Bearer invalid_token'
            });
            
            return invalidLogin.status === 400 && 
                   unauthorizedStake.status === 401 && 
                   invalidToken.status === 401;
        });
    }

    async testPerformance() {
        return this.runTest('Performance Test', async () => {
            const startTime = Date.now();
            const promises = [];
            
            // Make 10 concurrent requests
            for (let i = 0; i < 10; i++) {
                promises.push(this.makeRequest('GET', `${this.baseUrl}/health`));
            }
            
            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this.log(`10 concurrent requests completed in ${duration}ms`, 'info');
            return duration < 5000; // Pass if under 5 seconds
        });
    }

    async testLogout() {
        return this.runTest('Logout', async () => {
            if (!this.accessToken) {
                this.log('No access token available', 'warning');
                return false;
            }
            
            const result = await this.makeRequest('POST', `${this.authBase}/logout`, {}, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            return result.success && result.status === 200;
        });
    }

    // Main test runner
    async runAllTests() {
        this.log('🚀 Starting Lido Service API Test Suite', 'info');
        this.log(`Testing API at: ${this.baseUrl}`, 'info');
        this.log(`Test user: ${this.testUser}`, 'info');
        this.log(`Test amount: ${this.testAmount} ETH`, 'info');
        
        console.log('\n' + '='.repeat(50));
        
        // Run all tests
        await this.testHealthCheck();
        await this.testLogin();
        await this.testTokenVerification();
        await this.testTokenRefresh();
        await this.testStake();
        await this.testUnstake();
        await this.testClaimRewards();
        await this.testGetPosition();
        await this.testGetStakingHistory();
        await this.testGetProtocolInfo();
        await this.testErrorCases();
        await this.testPerformance();
        await this.testLogout();
        
        // Print results
        console.log('\n' + '='.repeat(50));
        this.log('📊 Test Results Summary', 'info');
        this.log(`Total tests: ${this.totalTests}`, 'info');
        this.log(`Passed: ${this.testsPassed}`, 'success');
        this.log(`Failed: ${this.testsFailed}`, this.testsFailed > 0 ? 'error' : 'success');
        
        if (this.testsFailed === 0) {
            this.log('🎉 All tests passed! API is working correctly.', 'success');
            return true;
        } else {
            this.log('❌ Some tests failed. Please check the API implementation.', 'error');
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new LidoAPITester();
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = LidoAPITester;
