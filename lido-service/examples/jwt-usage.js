/**
 * Authentication Usage Example for Lido Service
 * Authentication is handled by the centralized auth-service.
 * This example shows the full flow: auth-service login → lido-service API calls.
 */

const axios = require('axios');

class LidoServiceClient {
  constructor(
    lidoBaseUrl = 'http://localhost:3004',
    authBaseUrl = 'http://localhost:3001'
  ) {
    this.lidoBaseUrl = lidoBaseUrl;
    this.authBaseUrl = authBaseUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Step 1: Get SIWE payload from auth-service
   * Step 2: Sign with wallet (client-side)
   * Step 3: Verify signature with auth-service to get JWT
   */
  async login(userAddress, signedMessage) {
    try {
      console.log(`Login via auth-service for: ${userAddress}`);

      // In a real app, you would:
      // 1. GET auth-service/auth/login → get SIWE message to sign
      // 2. Sign message with wallet (Thirdweb, ethers, etc.)
      // 3. POST auth-service/auth/verify with signature → get JWT

      const response = await axios.post(`${this.authBaseUrl}/auth/verify`, {
        address: userAddress,
        signature: signedMessage
      });

      if (response.data.token) {
        this.accessToken = response.data.token;
        this.refreshToken = response.data.refreshToken;
        console.log('Login successful!');
        return response.data;
      }
      throw new Error(response.data.error || 'Login failed');
    } catch (error) {
      console.error('Login failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Refresh access token via auth-service
   */
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.authBaseUrl}/auth/refresh`, {
        refreshToken: this.refreshToken
      });

      if (response.data.token) {
        this.accessToken = response.data.token;
        console.log('Access token refreshed!');
        return this.accessToken;
      }
      throw new Error(response.data.error || 'Refresh failed');
    } catch (error) {
      console.error('Token refresh failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  getAuthHeaders() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async stake(userAddress, amount) {
    try {
      console.log(`Staking ${amount} ETH for ${userAddress}`);
      const response = await axios.post(`${this.lidoBaseUrl}/api/lido/stake`, {
        userAddress,
        amount
      }, { headers: this.getAuthHeaders() });

      console.log(`Stake tx prepared: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      console.error('Stake failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async unstake(userAddress, amount) {
    try {
      console.log(`Unstaking ${amount} stETH for ${userAddress}`);
      const response = await axios.post(`${this.lidoBaseUrl}/api/lido/unstake`, {
        userAddress,
        amount
      }, { headers: this.getAuthHeaders() });

      console.log(`Unstake tx prepared: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      console.error('Unstake failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async getPosition(userAddress) {
    try {
      const response = await axios.get(
        `${this.lidoBaseUrl}/api/lido/position/${userAddress}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Get position failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async getProtocolInfo() {
    try {
      const response = await axios.get(`${this.lidoBaseUrl}/api/lido/protocol/info`);
      return response.data.data;
    } catch (error) {
      console.error('Get protocol info failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }
}

// Example usage
async function example() {
  const client = new LidoServiceClient();
  const userAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

  try {
    console.log('Lido Service Auth Example');
    console.log('=========================\n');
    console.log('Auth flow:');
    console.log('  1. POST auth-service/auth/login   → get SIWE message');
    console.log('  2. Sign message with wallet');
    console.log('  3. POST auth-service/auth/verify   → get JWT');
    console.log('  4. Use JWT in Authorization header for lido-service calls\n');

    // Public endpoint (no auth needed)
    const protocolInfo = await client.getProtocolInfo();
    console.log('Protocol info:', protocolInfo);
  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

if (require.main === module) {
  example();
}

module.exports = LidoServiceClient;
