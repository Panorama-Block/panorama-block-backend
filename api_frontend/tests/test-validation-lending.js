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

// Testes das rotas básicas de lending
async function testBasicLendingRoutes() {
  console.log('🚀 Testando rotas básicas de lending...\n');

  try {
    // Teste 1: Listar qTokens disponíveis
    console.log('📋 Teste 1: Listando qTokens disponíveis...');
    const qTokensResponse = await axios.get(`${API_BASE_URL}/lending/qtokens`);
    console.log('✅ qTokens listados');
    console.log('📝 Total:', qTokensResponse.data.data.total, 'qTokens');
    console.log('📝 Primeiros 3:', qTokensResponse.data.data.qTokens.slice(0, 3).map(t => t.symbol).join(', '));
    console.log('');

    console.log('🎉 Testes básicos de lending concluídos!');

  } catch (error) {
    console.error('❌ Erro durante os testes básicos de lending:', error.message);
  }
}

// Testes das rotas de validação + lending
async function testValidationLendingRoutes() {
  console.log('🚀 Testando rotas de validação + lending...\n');

  if (!wallet) {
    console.log('⚠️ Wallet não disponível. Pulando testes de validação + lending.');
    return;
  }

  try {
    const qAVAXAddress = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c'; // qAVAX
    const amount = ethers.parseEther('0.01'); // 0.01 AVAX

    // Teste 1: Preparar transação de validação + supply
    console.log('📋 Teste 1: Preparando transação de validação + supply...');
    const supplyResponse = await makeAuthenticatedRequest('POST', '/lending/validate-supply', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de validação + supply preparada');
    console.log('📝 Operação:', supplyResponse.data.data.operation);
    console.log('📝 qToken:', 'qAVAX');
    console.log('📝 Amount:', ethers.formatEther(amount), 'AVAX');
    console.log('');

    // Teste 2: Preparar transação de validação + redeem
    console.log('📋 Teste 2: Preparando transação de validação + redeem...');
    const redeemResponse = await makeAuthenticatedRequest('POST', '/lending/validate-redeem', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString(),
      isUnderlying: true
    });
    console.log('✅ Transação de validação + redeem preparada');
    console.log('📝 Operação:', redeemResponse.data.data.operation);
    console.log('📝 qToken:', 'qAVAX');
    console.log('📝 Amount:', ethers.formatEther(amount), 'AVAX');
    console.log('');

    // Teste 3: Preparar transação de validação + borrow
    console.log('📋 Teste 3: Preparando transação de validação + borrow...');
    const borrowResponse = await makeAuthenticatedRequest('POST', '/lending/validate-borrow', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de validação + borrow preparada');
    console.log('📝 Operação:', borrowResponse.data.data.operation);
    console.log('📝 qToken:', 'qAVAX');
    console.log('📝 Amount:', ethers.formatEther(amount), 'AVAX');
    console.log('');

    // Teste 4: Preparar transação de validação + repay
    console.log('📋 Teste 4: Preparando transação de validação + repay...');
    const repayResponse = await makeAuthenticatedRequest('POST', '/lending/validate-repay', {
      qTokenAddress: qAVAXAddress,
      amount: amount.toString()
    });
    console.log('✅ Transação de validação + repay preparada');
    console.log('📝 Operação:', repayResponse.data.data.operation);
    console.log('📝 qToken:', 'qAVAX');
    console.log('📝 Amount:', ethers.formatEther(amount), 'AVAX');
    console.log('');

    console.log('🎉 Todos os testes de validação + lending foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes de validação + lending:', error.message);
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

  // Executa testes básicos de lending
  await testBasicLendingRoutes();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Executa testes de validação + lending
  await testValidationLendingRoutes();
  
  console.log('\n🎯 Todos os testes foram concluídos!');
}

// Executa os testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBasicLendingRoutes,
  testValidationLendingRoutes,
  makeAuthenticatedRequest,
  createSignature
};
