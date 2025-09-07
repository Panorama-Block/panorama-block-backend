require('dotenv').config();
const axios = require('axios');

// Configurações
const API_BASE_URL = 'http://localhost:3001';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Verificar se a private key está configurada
if (!PRIVATE_KEY) {
  console.log('❌ Erro: PRIVATE_KEY não encontrada no arquivo .env');
  console.log('💡 Adicione sua private key no arquivo .env:');
  console.log('   PRIVATE_KEY=0x1234567890abcdef...');
  process.exit(1);
}

// Função para fazer requisições HTTP
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      if (method === 'GET') {
        // Para GET, adiciona os dados como query params ou no body
        config.data = data;
      } else {
        config.data = data;
      }
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

// Teste 1: Health Check
async function testHealth() {
  console.log('🏥 Testando Health Check...');
  const result = await makeRequest('GET', '/health');
  
  if (result.success) {
    console.log('✅ Health Check OK:', result.data);
  } else {
    console.log('❌ Health Check falhou:', result.error);
  }
  console.log('');
}

// Teste 2: Info
async function testInfo() {
  console.log('ℹ️ Testando Info...');
  const result = await makeRequest('GET', '/info');
  
  if (result.success) {
    console.log('✅ Info OK:', result.data);
  } else {
    console.log('❌ Info falhou:', result.error);
  }
  console.log('');
}

// Teste 3: Network Status
async function testNetworkStatus() {
  console.log('🌐 Testando Network Status...');
  const result = await makeRequest('GET', '/network/status');
  
  if (result.success) {
    console.log('✅ Network Status OK:', result.data);
  } else {
    console.log('❌ Network Status falhou:', result.error);
  }
  console.log('');
}

// Teste 4: Config
async function testConfig() {
  console.log('⚙️ Testando Config...');
  const result = await makeRequest('GET', '/config');
  
  if (result.success) {
    console.log('✅ Config OK:', result.data);
  } else {
    console.log('❌ Config falhou:', result.error);
  }
  console.log('');
}

// Teste 5: Get Price
async function testGetPrice() {
  console.log('💱 Testando Get Price...');
  const result = await makeRequest('GET', '/dex/getprice?dexId=2100&path=0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&amountIn=1000000000000000', {
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Get Price OK:', result.data);
  } else {
    console.log('❌ Get Price falhou:', result.error);
  }
  console.log('');
}

// Teste 6: Get User Liquidity
async function testGetUserLiquidity() {
  console.log('👤 Testando Get User Liquidity...');
  const result = await makeRequest('GET', '/dex/getuserliquidity?tokenA=0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7&tokenB=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&dexId=2100&address=0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0&id=1', {
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Get User Liquidity OK:', result.data);
  } else {
    console.log('❌ Get User Liquidity falhou:', result.error);
  }
  console.log('');
}

// Teste 7: Get Pool Liquidity
async function testGetPoolLiquidity() {
  console.log('🏊 Testando Get Pool Liquidity...');
  const result = await makeRequest('GET', '/dex/getpoolliquidity?poolAddress=0x0000000000000000000000000000000000000000&dexId=2100&id=1', {
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Get Pool Liquidity OK:', result.data);
  } else {
    console.log('❌ Get Pool Liquidity falhou:', result.error);
  }
  console.log('');
}

// Teste 8: Get Token Liquidity
async function testGetTokenLiquidity() {
  console.log('🪙 Testando Get Token Liquidity...');
  const result = await makeRequest('GET', '/dex/gettokenliquidity?poolAddress=0x0000000000000000000000000000000000000000&dexId=2100', {
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Get Token Liquidity OK:', result.data);
  } else {
    console.log('❌ Get Token Liquidity falhou:', result.error);
  }
  console.log('');
}

// Teste 9: Swap (Principal)
async function testSwap() {
  console.log('🔄 Testando Swap WAVAX → USDT...');
  
  const swapData = {
    privateKey: PRIVATE_KEY,
    dexId: '2100',
    path: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    amountIn: '1000000000000000', // 0.001 WAVAX
    amountOutMin: '20000', // 0.02 USDT (slippage alto)
    to: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    from: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    deadline: (Math.floor(Date.now() / 1000) + 1800).toString(), // 30 minutos como string
    gas: '600000',
    gasPriority: 'medium',
    slippage: 90
  };
  
  const result = await makeRequest('POST', '/dex/swap', swapData);
  
  if (result.success) {
    console.log('✅ Swap OK:', result.data);
  } else {
    console.log('❌ Swap falhou:', result.error);
  }
  console.log('');
}

// Teste 10: Add Liquidity
async function testAddLiquidity() {
  console.log('➕ Testando Add Liquidity...');
  
  const liquidityData = {
    privateKey: PRIVATE_KEY,
    dexId: '2100',
    tokenA: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    tokenB: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    amountA: '1000000000000000', // 0.001 WAVAX
    amountB: '25000', // 0.025 USDT
    amountAMin: '900000000000000', // 0.0009 WAVAX
    amountBMin: '22500', // 0.0225 USDT
    deadline: (Math.floor(Date.now() / 1000) + 1800).toString(),
    to: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    from: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    gas: '530000',
    gasPriority: 'medium',
    slippage: 90,
    strategy: 'standard'
  };
  
  const result = await makeRequest('POST', '/dex/addliquidity', liquidityData);
  
  if (result.success) {
    console.log('✅ Add Liquidity OK:', result.data);
  } else {
    console.log('❌ Add Liquidity falhou:', result.error);
  }
  console.log('');
}

// Teste 11: Remove Liquidity
async function testRemoveLiquidity() {
  console.log('➖ Testando Remove Liquidity...');
  
  const liquidityData = {
    privateKey: PRIVATE_KEY,
    dexId: '2100',
    tokenA: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    tokenB: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    amountAMin: '900000000000000', // 0.0009 WAVAX
    amountBMin: '22500', // 0.0225 USDT
    deadline: (Math.floor(Date.now() / 1000) + 1800).toString(),
    from: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    to: '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0',
    gas: '500000',
    gasPriority: 'medium',
    binStep: '25',
    ids: ['1'],
    amounts: ['1000000000000000'], // 0.001 LP tokens
    slippage: 90
  };
  
  const result = await makeRequest('POST', '/dex/removeliquidity', liquidityData);
  
  if (result.success) {
    console.log('✅ Remove Liquidity OK:', result.data);
  } else {
    console.log('❌ Remove Liquidity falhou:', result.error);
  }
  console.log('');
}

// Função principal
async function runAllTests() {
  console.log('🚀 Teste Completo da API Trader Joe\n');
  console.log('📍 Private Key configurada:', PRIVATE_KEY.substring(0, 10) + '...');
  console.log('🌐 API Base URL:', API_BASE_URL);
  console.log('');
  
  // Verificar se a API está rodando
  console.log('🔍 Verificando se a API está rodando...');
  const healthCheck = await makeRequest('GET', '/health');
  if (!healthCheck.success) {
    console.log('❌ API não está rodando!');
    console.log('💡 Execute: npm start');
    return;
  }
  console.log('✅ API está rodando!\n');
  
  // Executar todos os testes
  await testHealth();
  await testInfo();
  await testNetworkStatus();
  await testConfig();
  await testGetPrice();
  await testGetUserLiquidity();
  await testGetPoolLiquidity();
  await testGetTokenLiquidity();
  await testSwap();
  await testAddLiquidity();
  await testRemoveLiquidity();
  
  console.log('🎉 Todos os testes concluídos!');
}

// Executar testes
runAllTests().catch(console.error);