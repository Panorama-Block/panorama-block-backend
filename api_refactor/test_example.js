const { ethers } = require('ethers');

// Configurações para teste
const API_BASE_URL = 'http://localhost:3001';
const WALLET_ADDRESS = '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0'; // Endereço da sua wallet
const RPC_URL = 'https://api.avax.network/ext/bc/C/rpc';

// Endereços de tokens comuns na Avalanche
const TOKENS = {
  WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  JOE: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd'
};

class APITester {
  constructor() {
    this.walletAddress = WALLET_ADDRESS;
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
  }

  /**
   * Cria uma requisição autenticada
   */
  createAuthenticatedRequest(data = {}) {
    const timestamp = Date.now();
    const message = `timestamp:${timestamp}`;
    
    return {
      address: this.walletAddress,
      signature: '', // Será preenchido após assinatura
      message: message,
      timestamp: timestamp,
      ...data
    };
  }

  /**
   * Simula assinatura de uma requisição (em produção, isso viria do frontend)
   */
  async signRequest(requestBody) {
    const message = requestBody.message;
    // Em produção, a assinatura viria do smart wallet do frontend
    // Aqui simulamos apenas para teste
    const signature = '0x' + '1'.repeat(130); // Assinatura simulada
    return { ...requestBody, signature };
  }

  /**
   * Faz uma requisição HTTP
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.error || 'Erro desconhecido'}`);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Erro na requisição para ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Testa endpoints básicos da API
   */
  async testBasicEndpoints() {
    console.log('🧪 Testando endpoints básicos...\n');

    try {
      // Health check
      const health = await this.makeRequest('/health');
      console.log('✅ Health Check:', health.status);

      // API Info
      const info = await this.makeRequest('/info');
      console.log('✅ API Info:', info.name, 'v' + info.version);

      // Network Status
      const networkStatus = await this.makeRequest('/network/status');
      console.log('✅ Network Status:', networkStatus.network.name);

      // Configuration
      const config = await this.makeRequest('/config');
      console.log('✅ Configuration:', config.network.chainId);

    } catch (error) {
      console.error('❌ Erro nos endpoints básicos:', error.message);
    }
  }




  /**
   * Testa endpoints da API Trader Joe (seguindo documentação)
   */
  async testTraderJoeEndpoints() {
    console.log('\n🏆 Testando endpoints da API Trader Joe...\n');

    try {
      // Testa /getprice
      const priceRequest = this.createAuthenticatedRequest({});
      const signedPriceRequest = await this.signRequest(priceRequest);
      
      const priceResponse = await this.makeRequest('/dex/getprice', 'GET', null, {
        dexId: '2100',
        path: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
        amountIn: '1000000000000000000'
      });
      console.log('✅ Preço obtido via /getprice:', priceResponse.data?.amountsOut || 'N/A');

      // Testa /getuserliquidity
      const userLiquidityResponse = await this.makeRequest('/dex/getuserliquidity', 'GET', null, {
        tokenA: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        tokenB: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
        address: this.walletAddress,
        dexId: '2100',
        id: '8376649'
      });
      console.log('✅ Liquidez do usuário obtida');

      // Testa /getpoolliquidity
      const poolLiquidityResponse = await this.makeRequest('/dex/getpoolliquidity', 'GET', null, {
        poolAddress: '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1',
        dexId: '2100',
        id: '8376653'
      });
      console.log('✅ Liquidez do pool obtida');

      // Testa /gettokenliquidity
      const tokenLiquidityResponse = await this.makeRequest('/dex/gettokenliquidity', 'GET', null, {
        poolAddress: '0x9f8973FB86b35C307324eC31fd81Cf565E2F4a63',
        dexId: '2100'
      });
      console.log('✅ Liquidez dos tokens obtida');

    } catch (error) {
      console.error('❌ Erro nos endpoints Trader Joe:', error.message);
    }
  }


  /**
   * Executa todos os testes
   */
  async runAllTests() {
    console.log('🚀 Iniciando testes da Zico Swap API\n');
    console.log(`📍 API: ${API_BASE_URL}`);
    console.log(`🔗 Rede: Avalanche C-Chain`);
    console.log(`👛 Wallet: ${this.walletAddress}\n`);

    try {
      await this.testBasicEndpoints();
      await this.testTraderJoeEndpoints();

      console.log('\n🎉 Todos os testes foram executados!');
      console.log('\n💡 Para executar swaps reais, use os endpoints de execução com transações assinadas pelo frontend.');

    } catch (error) {
      console.error('\n💥 Erro durante os testes:', error.message);
    }
  }
}

// Função principal
async function main() {
  // Verifica se o fetch está disponível (Node.js 18+)
  if (typeof fetch === 'undefined') {
    console.log('📦 Instalando node-fetch...');
    const { default: fetch } = await import('node-fetch');
    global.fetch = fetch;
  }

  const tester = new APITester();
  await tester.runAllTests();
}

// Executa os testes se o arquivo for executado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = APITester;
