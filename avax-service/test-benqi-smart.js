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
  // Fallback para testes sem private key
  TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
}

// Função para criar assinatura real
async function createSignature(message) {
  if (wallet) {
    // Usa assinatura real
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

// Testes das rotas do Benqi (smart wallet)
async function testBenqiSmartWallet() {
  console.log('🚀 Iniciando testes das rotas do Benqi (Smart Wallet)...\n');

  try {
    // Teste 1: Listar qTokens (sem autenticação)
    console.log('📋 Teste 1: Listando qTokens...');
    const qTokensResponse = await axios.get(`${API_BASE_URL}/benqi/qtokens`);
    console.log('✅ qTokens listados:', qTokensResponse.data.data.total, 'qTokens encontrados');
    console.log('📝 Primeiro qToken:', qTokensResponse.data.data.qTokens[0]);
    console.log('');

    // Teste 2: Obter informações de um qToken (com autenticação)
    console.log('📋 Teste 2: Obtendo informações do qAVAX...');
    const qAVAXAddress = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c'; // qAVAX (endereço real)
    try {
      const qTokenInfoResponse = await makeAuthenticatedRequest('GET', `/benqi/qtokens/${qAVAXAddress}`);
      console.log('✅ Informações do qToken obtidas:', qTokenInfoResponse.data.symbol);
      console.log('📝 Total Supply:', qTokenInfoResponse.data.totalSupply);
    } catch (error) {
      console.log('⚠️ Erro esperado (endereço inválido):', error.response?.data?.data?.error);
    }
    console.log('');

    // Teste 3: Obter taxas de juros
    console.log('📋 Teste 3: Obtendo taxas de juros do qAVAX...');
    try {
      const ratesResponse = await makeAuthenticatedRequest('GET', `/benqi/qtokens/${qAVAXAddress}/rates`);
      console.log('✅ Taxas de juros obtidas');
      console.log('📝 Supply Rate APY:', ratesResponse.data.supplyRateAPY);
      console.log('📝 Borrow Rate APY:', ratesResponse.data.borrowRateAPY);
    } catch (error) {
      console.log('⚠️ Erro esperado (endereço inválido):', error.response?.data?.data?.error);
    }
    console.log('');

    // Teste 4: Obter liquidez da conta
    console.log('📋 Teste 4: Obtendo liquidez da conta...');
    const liquidityResponse = await makeAuthenticatedRequest('GET', `/benqi/account/${TEST_ADDRESS}/liquidity`);
    console.log('✅ Liquidez da conta obtida');
    console.log('📝 Liquidez:', liquidityResponse.data.liquidity);
    console.log('📝 É saudável:', liquidityResponse.data.isHealthy);
    console.log('');

    // Teste 5: Obter ativos da conta
    console.log('📋 Teste 5: Obtendo ativos da conta...');
    const assetsResponse = await makeAuthenticatedRequest('GET', `/benqi/account/${TEST_ADDRESS}/assets`);
    console.log('✅ Ativos da conta obtidos');
    console.log('📝 Número de ativos:', assetsResponse.data.count);
    console.log('📝 Ativos:', assetsResponse.data.assets);
    console.log('');

    // Teste 6: Obter informações completas da conta
    console.log('📋 Teste 6: Obtendo informações completas da conta...');
    const accountInfoResponse = await makeAuthenticatedRequest('GET', `/benqi/account/${TEST_ADDRESS}/info`);
    console.log('✅ Informações completas da conta obtidas');
    console.log('📝 Total Supplied:', accountInfoResponse.data.summary.totalSupplied);
    console.log('📝 Total Borrowed:', accountInfoResponse.data.summary.totalBorrowed);
    console.log('📝 Health Factor:', accountInfoResponse.data.summary.healthFactor);
    console.log('');

    // Teste 7: Preparar transação de supply (smart wallet)
    console.log('📋 Teste 7: Preparando transação de supply...');
    const supplyAmount = ethers.parseEther('0.01'); // 0.01 AVAX
    const supplyResponse = await makeAuthenticatedRequest('POST', '/benqi/supply', {
      qTokenAddress: qAVAXAddress,
      amount: supplyAmount.toString()
    });
    console.log('✅ Transação de supply preparada');
    console.log('📝 Status:', supplyResponse.data.status);
    console.log('📝 Gas:', supplyResponse.data.gas);
    console.log('📝 To:', supplyResponse.data.to);
    console.log('📝 Data:', supplyResponse.data.data.substring(0, 20) + '...');
    console.log('');

    // Teste 8: Preparar transação de redeem
    console.log('📋 Teste 8: Preparando transação de redeem...');
    const redeemAmount = ethers.parseEther('0.005'); // 0.005 AVAX
    const redeemResponse = await makeAuthenticatedRequest('POST', '/benqi/redeem', {
      qTokenAddress: qAVAXAddress,
      amount: redeemAmount.toString(),
      isUnderlying: true
    });
    console.log('✅ Transação de redeem preparada');
    console.log('📝 Status:', redeemResponse.data.status);
    console.log('📝 Gas:', redeemResponse.data.gas);
    console.log('');

    // Teste 9: Preparar transação de borrow
    console.log('📋 Teste 9: Preparando transação de borrow...');
    const borrowAmount = ethers.parseEther('0.001'); // 0.001 AVAX
    const borrowResponse = await makeAuthenticatedRequest('POST', '/benqi/borrow', {
      qTokenAddress: qAVAXAddress,
      amount: borrowAmount.toString()
    });
    console.log('✅ Transação de borrow preparada');
    console.log('📝 Status:', borrowResponse.data.status);
    console.log('📝 Gas:', borrowResponse.data.gas);
    console.log('');

    // Teste 10: Preparar transação de repay
    console.log('📋 Teste 10: Preparando transação de repay...');
    const repayAmount = ethers.parseEther('0.0005'); // 0.0005 AVAX
    const repayResponse = await makeAuthenticatedRequest('POST', '/benqi/repay', {
      qTokenAddress: qAVAXAddress,
      amount: repayAmount.toString()
    });
    console.log('✅ Transação de repay preparada');
    console.log('📝 Status:', repayResponse.data.status);
    console.log('📝 Gas:', repayResponse.data.gas);
    console.log('');

    // Teste 11: Preparar transação de enterMarkets
    console.log('📋 Teste 11: Preparando transação de enterMarkets...');
    const qTokenAddresses = [qAVAXAddress];
    const enterMarketsResponse = await makeAuthenticatedRequest('POST', '/benqi/enterMarkets', {
      qTokenAddresses: qTokenAddresses
    });
    console.log('✅ Transação de enterMarkets preparada');
    console.log('📝 Status:', enterMarketsResponse.data.status);
    console.log('📝 Gas:', enterMarketsResponse.data.gas);
    console.log('');

    // Teste 12: Preparar transação de exitMarket
    console.log('📋 Teste 12: Preparando transação de exitMarket...');
    const exitMarketResponse = await makeAuthenticatedRequest('POST', '/benqi/exitMarket', {
      qTokenAddress: qAVAXAddress
    });
    console.log('✅ Transação de exitMarket preparada');
    console.log('📝 Status:', exitMarketResponse.data.status);
    console.log('📝 Gas:', exitMarketResponse.data.gas);
    console.log('');

    console.log('🎉 Todos os testes das rotas do Benqi (Smart Wallet) foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
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

  if (!wallet) {
    console.log('❌ Private key não fornecida. Testes de autenticação não podem ser executados.');
    return;
  }

  // Executa testes das rotas do Benqi (smart wallet)
  await testBenqiSmartWallet();
  
  console.log('\n🎯 Todos os testes foram concluídos!');
}

// Executa os testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBenqiSmartWallet,
  makeAuthenticatedRequest,
  createSignature
};
