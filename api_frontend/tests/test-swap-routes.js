require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configurações
const API_BASE_URL = 'http://localhost:3002';
const RPC_URL = process.env.RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Cria provider e wallet
const provider = new ethers.JsonRpcProvider(RPC_URL, {
  name: 'avalanche',
  chainId: 43114
}, {
  staticNetwork: true
});

let wallet;
if (PRIVATE_KEY) {
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
} else {
  console.log('⚠️ Private key não fornecida. Alguns testes serão pulados.');
}

// Função para criar assinatura real
async function createSignature(message) {
  if (!wallet) {
    throw new Error('Wallet não disponível');
  }
  const signature = await wallet.signMessage(message);
  return {
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now()
  };
}

// Função para fazer requisições autenticadas
async function makeAuthenticatedRequest(method, endpoint, data = {}) {
  const message = `${method} ${endpoint}\nTimestamp: ${Date.now()}`;
  const authData = await createSignature(message);
  
  const requestData = { ...authData, ...data };
  
  try {
    const response = await axios({
      method: method.toLowerCase(),
      url: `${API_BASE_URL}${endpoint}`,
      data: requestData,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Erro na requisição ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Testes das rotas básicas de swap
async function testBasicSwapRoutes() {
  console.log('🚀 Testando rotas básicas de swap...\n');

  try {
    // Teste 1: Listar tokens disponíveis
    console.log('📋 Teste 1: Listando tokens disponíveis...');
    const tokensResponse = await axios.get(`${API_BASE_URL}/swap/tokens`);
    console.log('✅ Tokens listados');
    console.log('📝 Total:', tokensResponse.data.data.total, 'tokens');
    console.log('📝 Tokens:', tokensResponse.data.data.tokens.map(t => t.symbol).join(', '));
    console.log('');

    console.log('🎉 Testes básicos de swap concluídos!');

  } catch (error) {
    console.error('❌ Erro durante os testes básicos de swap:', error.message);
  }
}

// Testes das rotas de validação + swap
async function testValidationSwapRoutes() {
  console.log('🚀 Testando rotas de validação + swap...\n');

  if (!wallet) {
    console.log('⚠️ Wallet não disponível. Pulando testes de validação + swap.');
    return;
  }

  try {
    const tokenIn = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // AVAX
    const tokenOut = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // USDC
    const amountIn = ethers.parseEther('1.0'); // 1 AVAX
    const minAmountOut = ethers.parseUnits('100', 6); // 100 USDC (6 decimais)

    // Teste 1: Obter cotação de validação + swap
    console.log('📋 Teste 1: Obtendo cotação de validação + swap...');
    const quoteResponse = await makeAuthenticatedRequest('POST', '/swap/validate-quote', {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString()
    });
    console.log('✅ Cotação obtida');
    console.log('📝 Token In:', 'AVAX');
    console.log('📝 Token Out:', 'USDC');
    console.log('📝 Amount In:', ethers.formatEther(amountIn), 'AVAX');
    console.log('');

    // Teste 2: Preparar transação de validação + swap
    console.log('📋 Teste 2: Preparando transação de validação + swap...');
    const prepareResponse = await makeAuthenticatedRequest('POST', '/swap/validate-swap', {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      minAmountOut: minAmountOut.toString()
    });
    console.log('✅ Transação preparada');
    console.log('📝 Operação:', prepareResponse.data.data.operation);
    console.log('📝 Network:', prepareResponse.data.data.network);
    console.log('');

    console.log('🎉 Todos os testes de validação + swap foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes de validação + swap:', error.message);
  }
}

// Função principal
async function main() {
  console.log('🔧 Configurações:');
  console.log('📡 API Base URL:', API_BASE_URL);
  console.log('🌐 RPC URL:', RPC_URL);
  console.log('👤 Wallet Address:', wallet ? wallet.address : 'N/A');
  console.log('🔑 Private Key:', PRIVATE_KEY ? 'Fornecida' : 'Não fornecida');
  console.log('');

  // Executa testes básicos de swap
  await testBasicSwapRoutes();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Executa testes de validação + swap
  await testValidationSwapRoutes();
  
  console.log('\n🎯 Todos os testes foram concluídos!');
}

// Executa os testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBasicSwapRoutes,
  testValidationSwapRoutes,
  makeAuthenticatedRequest,
  createSignature
};
