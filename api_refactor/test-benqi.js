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

// Endereço fixo para testes (sem private key)
const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

// Função para criar assinatura simulada (para testes)
async function createSignature(message) {
  // Para testes, vamos simular uma assinatura
  const mockSignature = '0x' + 'a'.repeat(130); // Assinatura simulada
  return {
    address: TEST_ADDRESS,
    signature: mockSignature,
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

// Testes das rotas do Benqi
async function testBenqiRoutes() {
  console.log('🚀 Iniciando testes das rotas do Benqi...\n');

  try {
    // Teste 1: Listar qTokens
    console.log('📋 Teste 1: Listando qTokens...');
    const qTokensResponse = await makeAuthenticatedRequest('GET', '/benqi/qtokens');
    console.log('✅ qTokens listados:', qTokensResponse.data.total, 'qTokens encontrados');
    console.log('📝 Primeiro qToken:', qTokensResponse.data.qTokens[0]);
    console.log('');

    // Teste 2: Obter informações de um qToken
    console.log('📋 Teste 2: Obtendo informações do qAVAX...');
    const qAVAXAddress = '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7'; // qAVAX
    const qTokenInfoResponse = await makeAuthenticatedRequest('GET', `/benqi/qtokens/${qAVAXAddress}`);
    console.log('✅ Informações do qToken obtidas:', qTokenInfoResponse.data.symbol);
    console.log('📝 Total Supply:', qTokenInfoResponse.data.totalSupply);
    console.log('');

    // Teste 3: Obter taxas de juros
    console.log('📋 Teste 3: Obtendo taxas de juros do qAVAX...');
    const ratesResponse = await makeAuthenticatedRequest('GET', `/benqi/qtokens/${qAVAXAddress}/rates`);
    console.log('✅ Taxas de juros obtidas');
    console.log('📝 Supply Rate APY:', ratesResponse.data.supplyRateAPY);
    console.log('📝 Borrow Rate APY:', ratesResponse.data.borrowRateAPY);
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

    // Teste 7: Preparar transação de supply
    console.log('📋 Teste 7: Preparando transação de supply...');
    const supplyAmount = ethers.parseEther('1.0'); // 1 AVAX
    const supplyResponse = await makeAuthenticatedRequest('POST', '/benqi/supply', {
      qTokenAddress: qAVAXAddress,
      amount: supplyAmount.toString()
    });
    console.log('✅ Transação de supply preparada');
    console.log('📝 Status:', supplyResponse.data.status);
    console.log('📝 Gas:', supplyResponse.data.gas);
    console.log('📝 To:', supplyResponse.data.to);
    console.log('');

    // Teste 8: Preparar transação de redeem
    console.log('📋 Teste 8: Preparando transação de redeem...');
    const redeemAmount = ethers.parseEther('0.5'); // 0.5 AVAX
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
    const borrowAmount = ethers.parseEther('0.1'); // 0.1 AVAX
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
    const repayAmount = ethers.parseEther('0.05'); // 0.05 AVAX
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

    console.log('🎉 Todos os testes das rotas do Benqi foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  }
}

// Testes das rotas de validação + lending
async function testBenqiValidationRoutes() {
  console.log('🚀 Iniciando testes das rotas de validação + lending...\n');

  try {
    // Teste 1: Obter cotação de validação + supply
    console.log('📋 Teste 1: Obtendo cotação de validação + supply...');
    const supplyQuoteResponse = await makeAuthenticatedRequest('POST', '/benqi-validation/getValidationAndSupplyQuote', {
      amount: ethers.parseEther('1.0').toString(), // 1 AVAX
      qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7' // qAVAX
    });
    console.log('✅ Cotação de validação + supply obtida');
    console.log('📝 Taxa:', supplyQuoteResponse.data.validation.taxRate);
    console.log('📝 Taxa paga:', supplyQuoteResponse.data.validation.taxAmount);
    console.log('📝 Valor restante:', supplyQuoteResponse.data.validation.restAmount);
    console.log('');

    // Teste 2: Obter cotação de validação + borrow
    console.log('📋 Teste 2: Obtendo cotação de validação + borrow...');
    const borrowQuoteResponse = await makeAuthenticatedRequest('POST', '/benqi-validation/getValidationAndBorrowQuote', {
      amount: ethers.parseEther('0.5').toString(), // 0.5 AVAX
      qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7' // qAVAX
    });
    console.log('✅ Cotação de validação + borrow obtida');
    console.log('📝 Taxa:', borrowQuoteResponse.data.validation.taxRate);
    console.log('📝 Taxa paga:', borrowQuoteResponse.data.validation.taxAmount);
    console.log('📝 Valor restante:', borrowQuoteResponse.data.validation.restAmount);
    console.log('');

    // Teste 3: Executar validação + supply (com private key)
    if (PRIVATE_KEY) {
      console.log('📋 Teste 3: Executando validação + supply...');
      const validateAndSupplyResponse = await makeAuthenticatedRequest('POST', '/benqi-validation/validateAndSupply', {
        amount: ethers.parseEther('0.1').toString(), // 0.1 AVAX
        qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7', // qAVAX
        privateKey: PRIVATE_KEY
      });
      console.log('✅ Validação + supply executada');
      console.log('📝 Hash da validação:', validateAndSupplyResponse.data.validation.transactionHash);
      console.log('📝 Hash do supply:', validateAndSupplyResponse.data.supply.transactionHash);
      console.log('');

      // Teste 4: Executar validação + borrow (com private key)
      console.log('📋 Teste 4: Executando validação + borrow...');
      const validateAndBorrowResponse = await makeAuthenticatedRequest('POST', '/benqi-validation/validateAndBorrow', {
        amount: ethers.parseEther('0.05').toString(), // 0.05 AVAX
        qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7', // qAVAX
        privateKey: PRIVATE_KEY
      });
      console.log('✅ Validação + borrow executada');
      console.log('📝 Hash da validação:', validateAndBorrowResponse.data.validation.transactionHash);
      console.log('📝 Hash do borrow:', validateAndBorrowResponse.data.borrow.transactionHash);
      console.log('');
    } else {
      console.log('⚠️ Private key não fornecida, pulando testes de execução...');
    }

    console.log('🎉 Todos os testes das rotas de validação + lending foram executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes de validação:', error.message);
  }
}

// Função principal
async function main() {
  console.log('🔧 Configurações:');
  console.log('📡 API Base URL:', API_BASE_URL);
  console.log('🌐 RPC URL:', RPC_URL);
  console.log('👤 Test Address:', TEST_ADDRESS);
  console.log('🔑 Private Key:', PRIVATE_KEY ? 'Fornecida' : 'Não fornecida');
  console.log('');

  // Executa testes das rotas do Benqi
  await testBenqiRoutes();
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Executa testes das rotas de validação + lending
  await testBenqiValidationRoutes();
  
  console.log('\n🎯 Todos os testes foram concluídos!');
}

// Executa os testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBenqiRoutes,
  testBenqiValidationRoutes,
  makeAuthenticatedRequest,
  createSignature
};
