require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configurações
const API_BASE_URL = 'http://localhost:3001';
const RPC_URL = process.env.RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Cria provider para testes
const provider = new ethers.JsonRpcProvider(RPC_URL, {
  name: 'avalanche',
  chainId: 43114
}, {
  staticNetwork: true
});

// Cria wallet real para testes
let wallet;
let TEST_ADDRESS;

if (PRIVATE_KEY) {
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  TEST_ADDRESS = wallet.address;
} else {
  TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
}

// Função para criar assinatura real
async function createSignature(message) {
  if (wallet) {
    const signature = await wallet.signMessage(message);
    return {
      address: wallet.address,
      signature: signature,
      message: message,
      timestamp: Date.now()
    };
  } else {
    throw new Error('Wallet não disponível para assinatura');
  }
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

// Testes das funcionalidades básicas
async function testBasicFunctionality() {
  console.log('🚀 Testando funcionalidades básicas da API do Benqi...\n');

  try {
    // Teste 1: Listar qTokens (sem autenticação)
    console.log('📋 Teste 1: Listando qTokens...');
    const qTokensResponse = await axios.get(`${API_BASE_URL}/benqi/qtokens`);
    console.log('✅ qTokens listados:', qTokensResponse.data.data.total, 'qTokens encontrados');
    console.log('📝 qTokens disponíveis:', qTokensResponse.data.data.qTokens.map(t => t.symbol).join(', '));
    console.log('');

    // Teste 2: Informações da API
    console.log('📋 Teste 2: Informações da API...');
    const infoResponse = await axios.get(`${API_BASE_URL}/info`);
    console.log('✅ API Info obtida');
    console.log('📝 Nome:', infoResponse.data.name);
    console.log('📝 Versão:', infoResponse.data.version);
    console.log('📝 Protocolos suportados:', infoResponse.data.supportedProtocols.join(', '));
    console.log('📝 Endpoints Benqi:', infoResponse.data.endpoints.benqi);
    console.log('');

    // Teste 3: Health check
    console.log('📋 Teste 3: Health check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check OK');
    console.log('📝 Status:', healthResponse.data.status);
    console.log('📝 Network:', healthResponse.data.network);
    console.log('');

    console.log('🎉 Testes básicos concluídos com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes básicos:', error.message);
  }
}

// Testes das rotas de preparação de transações
async function testTransactionPreparation() {
  console.log('🚀 Testando preparação de transações...\n');

  if (!wallet) {
    console.log('⚠️ Wallet não disponível. Pulando testes de transações.');
    return;
  }

  try {
    const qAVAXAddress = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
    const amount = ethers.parseEther('0.01'); // 0.01 AVAX

    // Teste 1: Preparar transação de supply
    console.log('📋 Teste 1: Preparando transação de supply...');
    const supplyResponse = await makeAuthenticatedRequest('POST', '/benqi/supply', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de supply preparada');
    console.log('📝 Status:', supplyResponse.data.status);
    console.log('📝 Gas:', supplyResponse.data.gas);
    console.log('📝 To:', supplyResponse.data.to);
    console.log('');

    // Teste 2: Preparar transação de redeem
    console.log('📋 Teste 2: Preparando transação de redeem...');
    const redeemResponse = await makeAuthenticatedRequest('POST', '/benqi/redeem', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString(),
      isUnderlying: true
    });
    console.log('✅ Transação de redeem preparada');
    console.log('📝 Status:', redeemResponse.data.status);
    console.log('📝 Gas:', redeemResponse.data.gas);
    console.log('');

    // Teste 3: Preparar transação de borrow
    console.log('📋 Teste 3: Preparando transação de borrow...');
    const borrowResponse = await makeAuthenticatedRequest('POST', '/benqi/borrow', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de borrow preparada');
    console.log('📝 Status:', borrowResponse.data.status);
    console.log('📝 Gas:', borrowResponse.data.gas);
    console.log('');

    // Teste 4: Preparar transação de repay
    console.log('📋 Teste 4: Preparando transação de repay...');
    const repayResponse = await makeAuthenticatedRequest('POST', '/benqi/repay', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de repay preparada');
    console.log('📝 Status:', repayResponse.data.status);
    console.log('📝 Gas:', repayResponse.data.gas);
    console.log('');

    // Teste 5: Preparar transação de enterMarkets
    console.log('📋 Teste 5: Preparando transação de enterMarkets...');
    const enterMarketsResponse = await makeAuthenticatedRequest('POST', '/benqi/enterMarkets', {
      qTokenAddresses: [qAVAXAddress]
    });
    console.log('✅ Transação de enterMarkets preparada');
    console.log('📝 Status:', enterMarketsResponse.data.status);
    console.log('📝 Gas:', enterMarketsResponse.data.gas);
    console.log('');

    // Teste 6: Preparar transação de exitMarket
    console.log('📋 Teste 6: Preparando transação de exitMarket...');
    const exitMarketResponse = await makeAuthenticatedRequest('POST', '/benqi/exitMarket', {
      qTokenAddress: qAVAXAddress
    });
    console.log('✅ Transação de exitMarket preparada');
    console.log('📝 Status:', exitMarketResponse.data.status);
    console.log('📝 Gas:', exitMarketResponse.data.gas);
    console.log('');

    console.log('🎉 Todos os testes de preparação de transações foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes de transações:', error.message);
  }
}

// Função principal
async function main() {
  console.log('🔧 Configurações:');
  console.log('📡 API Base URL:', API_BASE_URL);
  console.log('🌐 RPC URL:', RPC_URL);
  console.log('👤 Test Address:', TEST_ADDRESS);
  console.log('👤 Wallet Address:', wallet ? wallet.address : 'N/A');
  console.log('🔑 Private Key:', PRIVATE_KEY ? 'Fornecida' : 'Não fornecida');
  console.log('');

  // Executa testes básicos
  await testBasicFunctionality();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Executa testes de transações
  await testTransactionPreparation();
  
  console.log('\n🎯 Todos os testes foram concluídos!');
}

// Executa os testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBasicFunctionality,
  testTransactionPreparation,
  makeAuthenticatedRequest,
  createSignature
};
