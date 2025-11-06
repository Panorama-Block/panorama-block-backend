/**
 * JWT Authentication Usage Example for Lido Service
 * This example shows how to use JWT authentication with the Lido Service API
 */

const axios = require('axios');

class LidoServiceClient {
  constructor(baseUrl = 'http://localhost:3004') {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Login with user address to get JWT tokens
   */
  async login(userAddress) {
    try {
      console.log(`🔐 Logging in user: ${userAddress}`);
      
      const response = await axios.post(`${this.baseUrl}/api/lido/auth/login`, {
        userAddress: userAddress
      });

      if (response.data.success) {
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        
        console.log('✅ Login successful!');
        console.log(`Access Token: ${this.accessToken.substring(0, 50)}...`);
        console.log(`Refresh Token: ${this.refreshToken.substring(0, 50)}...`);
        
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Login failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    try {
      console.log('🔄 Refreshing access token...');
      
      const response = await axios.post(`${this.baseUrl}/api/lido/auth/refresh`, {
        refreshToken: this.refreshToken
      });

      if (response.data.success) {
        this.accessToken = response.data.data.accessToken;
        console.log('✅ Access token refreshed!');
        return this.accessToken;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Verify current access token
   */
  async verifyToken() {
    try {
      console.log('🔍 Verifying access token...');
      
      const response = await axios.get(`${this.baseUrl}/api/lido/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (response.data.success) {
        console.log('✅ Token is valid!');
        console.log(`User: ${response.data.data.userAddress}`);
        console.log(`Expires: ${response.data.data.expiresAt}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Token verification failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Get authorization headers
   */
  getAuthHeaders() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Stake ETH
   */
  async stake(userAddress, amount) {
    try {
      console.log(`💰 Staking ${amount} ETH for ${userAddress}`);
      
      const response = await axios.post(`${this.baseUrl}/api/lido/stake`, {
        userAddress: userAddress,
        amount: amount
      }, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        console.log('✅ Stake transaction created!');
        console.log(`Transaction ID: ${response.data.data.id}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Stake failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Unstake stETH
   */
  async unstake(userAddress, amount) {
    try {
      console.log(`💸 Unstaking ${amount} stETH for ${userAddress}`);
      
      const response = await axios.post(`${this.baseUrl}/api/lido/unstake`, {
        userAddress: userAddress,
        amount: amount
      }, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        console.log('✅ Unstake transaction created!');
        console.log(`Transaction ID: ${response.data.data.id}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Unstake failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Get staking position
   */
  async getPosition(userAddress) {
    try {
      console.log(`📊 Getting position for ${userAddress}`);
      
      const response = await axios.get(`${this.baseUrl}/api/lido/position/${userAddress}`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        console.log('✅ Position retrieved!');
        if (response.data.data) {
          console.log(`Staked Amount: ${response.data.data.stakedAmount} ETH`);
          console.log(`stETH Balance: ${response.data.data.stETHBalance}`);
          console.log(`APY: ${response.data.data.apy}%`);
        } else {
          console.log('No staking position found');
        }
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Get position failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Get protocol information
   */
  async getProtocolInfo() {
    try {
      console.log('📈 Getting protocol information...');
      
      const response = await axios.get(`${this.baseUrl}/api/lido/protocol/info`);

      if (response.data.success) {
        console.log('✅ Protocol info retrieved!');
        console.log(`Total Staked: ${response.data.data.totalStaked} ETH`);
        console.log(`Current APY: ${response.data.data.currentAPY}%`);
        console.log(`stETH Price: $${response.data.data.stETHPrice}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Get protocol info failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Logout (client-side token invalidation)
   */
  async logout() {
    try {
      console.log('👋 Logging out...');
      
      const response = await axios.post(`${this.baseUrl}/api/lido/auth/logout`, {}, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        this.accessToken = null;
        this.refreshToken = null;
        console.log('✅ Logged out successfully!');
        return true;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('❌ Logout failed:', error.response?.data?.error || error.message);
      throw error;
    }
  }
}

// Example usage
async function example() {
  const client = new LidoServiceClient();
  const userAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

  try {
    console.log('🚀 Starting Lido Service JWT Example');
    console.log('=====================================\n');

    // 1. Login
    await client.login(userAddress);
    console.log('');

    // 2. Verify token
    await client.verifyToken();
    console.log('');

    // 3. Get protocol info (public endpoint)
    await client.getProtocolInfo();
    console.log('');

    // 4. Get user position
    await client.getPosition(userAddress);
    console.log('');

    // 5. Stake ETH (protected endpoint)
    await client.stake(userAddress, '1.0');
    console.log('');

    // 6. Refresh token
    await client.refreshAccessToken();
    console.log('');

    // 7. Unstake stETH (protected endpoint)
    await client.unstake(userAddress, '0.5');
    console.log('');

    // 8. Logout
    await client.logout();
    console.log('');

    console.log('✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  example();
}

module.exports = LidoServiceClient;
