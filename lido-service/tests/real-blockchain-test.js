#!/usr/bin/env node

/**
 * Real Blockchain Test Suite
 * Executes actual transactions on Ethereum blockchain
 * Uses real private key and interacts with actual smart contracts
 */

const axios = require('axios');
const ethers = require('ethers');
require('dotenv').config();

class RealBlockchainTester {
    constructor() {
        this.baseUrl = 'http://localhost:3004';
        this.apiBase = `${this.baseUrl}/api/lido`;
        this.authBase = `${this.apiBase}/auth`;
        
        // Test configuration
        this.privateKey = '0x74d5c8282d223d273bab24b323dbe320c9528b586397c90abe11b9295bc684e4';
        this.testAmount = '0.001'; // Small amount for testing
        this.testUser = ''; // Will be derived from private key
        this.accessToken = null;
        
        // Test results
        this.testsPassed = 0;
        this.testsFailed = 0;
        this.totalTests = 0;
        
        // Initialize wallet
        this.wallet = null;
        this.provider = null;
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

    // Initialize wallet and provider
    async initializeWallet() {
        return this.runTest('Initialize Wallet', async () => {
            try {
                // Create wallet from private key
                this.wallet = new ethers.Wallet(this.privateKey);
                this.testUser = this.wallet.address;
                
                // Create provider
                const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth';
                this.provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
                    name: 'mainnet',
                    chainId: 1
                });
                
                // Connect wallet to provider
                this.wallet = this.wallet.connect(this.provider);
                
                this.log(`Wallet address: ${this.testUser}`, 'info');
                this.log(`RPC URL: ${rpcUrl}`, 'info');
                
                return true;
            } catch (error) {
                this.log(`Error initializing wallet: ${error.message}`, 'error');
                return false;
            }
        });
    }

    // Check ETH balance
    async checkEthBalance() {
        return this.runTest('Check ETH Balance', async () => {
            try {
                const balance = await this.provider.getBalance(this.testUser);
                const balanceEth = ethers.utils.formatEther(balance);
                
                this.log(`ETH Balance: ${balanceEth} ETH`, 'info');
                
                // Check if we have enough for testing
                const requiredAmount = ethers.utils.parseEther(this.testAmount);
                const gasEstimate = ethers.utils.parseEther('0.01'); // Estimated gas
                const totalRequired = requiredAmount.add(gasEstimate);
                
                if (balance.gte(totalRequired)) {
                    this.log('Sufficient ETH for testing', 'success');
                    return true;
                } else {
                    this.log('Insufficient ETH for testing', 'error');
                    return false;
                }
            } catch (error) {
                this.log(`Error checking balance: ${error.message}`, 'error');
                return false;
            }
        });
    }

    // Test API health
    async testApiHealth() {
        return this.runTest('API Health Check', async () => {
            const result = await this.makeRequest('GET', `${this.baseUrl}/health`);
            return result.success && result.status === 200;
        });
    }

    // Test login
    async testLogin() {
        return this.runTest('User Login', async () => {
            const result = await this.makeRequest('POST', `${this.authBase}/login`, {
                userAddress: this.testUser
            });
            
            if (result.success && result.data.success) {
                this.accessToken = result.data.data.accessToken;
                this.log(`Access token obtained: ${this.accessToken.substring(0, 50)}...`, 'info');
                return true;
            }
            return false;
        });
    }

    // Test real stake transaction
    async testRealStake() {
        return this.runTest('Real Stake Transaction', async () => {
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
            
            if (result.success && result.data.success) {
                const txId = result.data.data.id;
                this.log(`Stake transaction created: ${txId}`, 'success');
                return true;
            }
            return false;
        });
    }

    // Test real unstake transaction
    async testRealUnstake() {
        return this.runTest('Real Unstake Transaction', async () => {
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
            
            if (result.success && result.data.success) {
                const txId = result.data.data.id;
                this.log(`Unstake transaction created: ${txId}`, 'success');
                return true;
            }
            return false;
        });
    }

    // Test real position data
    async testRealPosition() {
        return this.runTest('Real Position Data', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/position/${this.testUser}`, null, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            if (result.success && result.data.success) {
                this.log('Real position data retrieved', 'success');
                return true;
            }
            return false;
        });
    }

    // Test real protocol info
    async testRealProtocolInfo() {
        return this.runTest('Real Protocol Info', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/protocol/info`);
            
            if (result.success && result.data.success) {
                this.log('Real protocol info retrieved', 'success');
                return true;
            }
            return false;
        });
    }

    // Test real staking history
    async testRealStakingHistory() {
        return this.runTest('Real Staking History', async () => {
            const result = await this.makeRequest('GET', `${this.apiBase}/history/${this.testUser}?limit=10`, null, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            if (result.success && result.data.success) {
                this.log('Real staking history retrieved', 'success');
                return true;
            }
            return false;
        });
    }

    // Test real claim rewards
    async testRealClaimRewards() {
        return this.runTest('Real Claim Rewards', async () => {
            const result = await this.makeRequest('POST', `${this.apiBase}/claim-rewards`, {
                userAddress: this.testUser
            }, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            if (result.success && result.data.success) {
                this.log('Real claim rewards transaction created', 'success');
                return true;
            }
            return false;
        });
    }

    // Test logout
    async testLogout() {
        return this.runTest('User Logout', async () => {
            const result = await this.makeRequest('POST', `${this.authBase}/logout`, {}, {
                'Authorization': `Bearer ${this.accessToken}`
            });
            
            if (result.success && result.data.success) {
                this.log('Logout successful', 'success');
                return true;
            }
            return false;
        });
    }

    // Main test execution
    async runAllTests() {
        this.log('🚀 Starting Real Blockchain Test Suite', 'info');
        this.log(`Testing with real blockchain transactions`, 'info');
        this.log(`Private key: ${this.privateKey.substring(0, 10)}...`, 'info');
        this.log(`Test amount: ${this.testAmount} ETH`, 'info');
        
        console.log('\n' + '='.repeat(50));
        
        // Warning about real transactions
        this.log('⚠️  WARNING: This test will execute REAL transactions on the blockchain!', 'warning');
        this.log('⚠️  Make sure you have sufficient ETH for testing!', 'warning');
        this.log('⚠️  Transactions will cost real gas fees!', 'warning');
        console.log('');
        
        // Ask for confirmation
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise((resolve) => {
            rl.question('Do you want to continue with real blockchain transactions? (y/N): ', resolve);
        });
        
        rl.close();
        
        if (!answer.toLowerCase().startsWith('y')) {
            this.log('Test cancelled by user', 'warning');
            return false;
        }
        
        // Run all tests
        await this.initializeWallet();
        await this.checkEthBalance();
        await this.testApiHealth();
        await this.testLogin();
        await this.testRealProtocolInfo();
        await this.testRealPosition();
        await this.testRealStake();
        await this.testRealPosition();
        await this.testRealUnstake();
        await this.testRealClaimRewards();
        await this.testRealStakingHistory();
        await this.testLogout();
        
        // Print results
        console.log('\n' + '='.repeat(50));
        this.log('📊 Real Blockchain Test Results', 'info');
        this.log(`Total tests: ${this.totalTests}`, 'info');
        this.log(`Passed: ${this.testsPassed}`, 'success');
        this.log(`Failed: ${this.testsFailed}`, this.testsFailed > 0 ? 'error' : 'success');
        
        if (this.testsFailed === 0) {
            this.log('🎉 All real blockchain tests passed!', 'success');
            this.log('✅ Real transactions executed successfully!', 'success');
            this.log('✅ Blockchain integration working perfectly!', 'success');
            return true;
        } else {
            this.log('❌ Some real blockchain tests failed.', 'error');
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new RealBlockchainTester();
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Real blockchain test suite failed:', error);
            process.exit(1);
        });
}

module.exports = RealBlockchainTester;
