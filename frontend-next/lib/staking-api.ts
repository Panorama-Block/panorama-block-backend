import { useActiveAccount } from 'thirdweb/react';

export interface StakingPosition {
  id: string;
  userAddress: string;
  stakedAmount: string;
  stETHBalance: string;
  wstETHBalance: string;
  rewards: string;
  apy: number;
  timestamp: string;
  status: 'active' | 'pending' | 'completed' | 'failed';
}

export interface StakingTransaction {
  id: string;
  userAddress: string;
  type: 'stake' | 'unstake' | 'claim_rewards';
  amount: string;
  token: 'ETH' | 'stETH' | 'wstETH';
  transactionHash?: string;
  blockNumber?: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  gasUsed?: string;
  gasPrice?: string;
  transactionData?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
}

export interface AuthResponse {
  success: boolean;
  data: {
    userAddress: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
}

export class StakingApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3004') {
    this.baseUrl = baseUrl;
  }

  // Autenticação JWT
  async login(userAddress: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/api/lido/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userAddress }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      this.accessToken = result.data.accessToken;
      this.refreshToken = result.data.refreshToken;
    }

    return result;
  }

  // Refresh token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/api/lido/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      this.accessToken = result.data.accessToken;
      return result.data.accessToken;
    }

    throw new Error('Token refresh failed');
  }

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  // Obter token atual
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Fazer requisição autenticada
  private async authenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    // Se token expirado, tentar refresh
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        // Tentar novamente com novo token
        return fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
            ...options.headers,
          },
        });
      } catch (error) {
        // Se refresh falhar, limpar tokens
        this.accessToken = null;
        this.refreshToken = null;
        throw new Error('Authentication expired. Please login again.');
      }
    }

    return response;
  }

  // Operações de staking
  async stake(userAddress: string, amount: string): Promise<StakingTransaction> {
    const response = await this.authenticatedRequest('/api/lido/stake', {
      method: 'POST',
      body: JSON.stringify({ userAddress, amount }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Staking failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Staking failed: ${result.error}`);
    }

    return result.data;
  }

  async unstake(userAddress: string, amount: string): Promise<StakingTransaction> {
    const response = await this.authenticatedRequest('/api/lido/unstake', {
      method: 'POST',
      body: JSON.stringify({ userAddress, amount }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unstaking failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Unstaking failed: ${result.error}`);
    }

    return result.data;
  }

  async claimRewards(userAddress: string): Promise<StakingTransaction> {
    const response = await this.authenticatedRequest('/api/lido/claim-rewards', {
      method: 'POST',
      body: JSON.stringify({ userAddress }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claim rewards failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Claim rewards failed: ${result.error}`);
    }

    return result.data;
  }

  async getPosition(userAddress: string): Promise<StakingPosition | null> {
    const response = await this.authenticatedRequest(`/api/lido/position/${userAddress}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Usuário não tem posição
      }
      const error = await response.text();
      throw new Error(`Get position failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      return null;
    }

    return result.data;
  }

  async getProtocolInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/lido/protocol/info`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get protocol info failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Get protocol info failed: ${result.error}`);
    }

    return result.data;
  }

  // Executar transação (para smart wallets)
  async executeTransaction(transactionData: any): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionData],
      });

      return txHash;
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}

// Hook para usar o cliente de staking
export function useStakingApi() {
  const account = useActiveAccount();
  
  const apiClient = new StakingApiClient();
  
  return {
    apiClient,
    isConnected: !!account,
    userAddress: account?.address,
  };
}
