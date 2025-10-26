const { ethers } = require('ethers');

// Configurações
const API_BASE_URL = 'http://localhost:3001';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const SMART_WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

/**
 * Gera assinatura para smart wallet
 */
async function createSmartWalletSignature(message) {
  // Simula assinatura de smart wallet (em produção, viria do frontend)
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const signature = await wallet.signMessage(message);
  return signature;
}

/**
 * Gera assinatura para private key
 */
async function createPrivateKeySignature(message) {
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const signature = await wallet.signMessage(message);
  return signature;
}

/**
 * Faz requisição autenticada
 */
async function makeAuthenticatedRequest(method, endpoint, data = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${result.error || result.msg}`);
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error(`❌ Erro na requisição ${method} ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Teste 1: Smart Wallet - Calculate Tax
 */
async function testSmartWalletCalculateTax() {
  console.log('🧪 Teste 1: Smart Wallet - Calculate Tax');
  
  const message = `Calculate tax for amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createSmartWalletSignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/validation/calculate', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    isSmartWallet: true,
    walletType: 'smart_wallet'
  });
  
  if (result.success) {
    console.log('✅ Smart Wallet Calculate Tax OK:', result.data);
  } else {
    console.log('❌ Smart Wallet Calculate Tax Failed:', result.error);
  }
}

/**
 * Teste 2: Private Key - Calculate Tax
 */
async function testPrivateKeyCalculateTax() {
  console.log('🧪 Teste 2: Private Key - Calculate Tax');
  
  const message = `Calculate tax for amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createPrivateKeySignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/validation/calculate', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Private Key Calculate Tax OK:', result.data);
  } else {
    console.log('❌ Private Key Calculate Tax Failed:', result.error);
  }
}

/**
 * Teste 3: Smart Wallet - Prepare Pay and Validate
 */
async function testSmartWalletPayAndValidate() {
  console.log('🧪 Teste 3: Smart Wallet - Prepare Pay and Validate');
  
  const message = `Pay and validate amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createSmartWalletSignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/validation/payAndValidate', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    isSmartWallet: true,
    walletType: 'smart_wallet'
  });
  
  if (result.success) {
    console.log('✅ Smart Wallet Pay and Validate OK:', result.data);
    console.log('   - Wallet Type:', result.data.walletType);
    console.log('   - Requires Signature:', result.data.requiresSignature);
    console.log('   - Note:', result.data.note);
  } else {
    console.log('❌ Smart Wallet Pay and Validate Failed:', result.error);
  }
}

/**
 * Teste 4: Private Key - Execute Pay and Validate
 */
async function testPrivateKeyPayAndValidate() {
  console.log('🧪 Teste 4: Private Key - Execute Pay and Validate');
  
  const message = `Pay and validate amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createPrivateKeySignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/validation/payAndValidate', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Private Key Pay and Validate OK:', result.data);
    console.log('   - Wallet Type:', result.data.walletType);
    console.log('   - Requires Signature:', result.data.requiresSignature);
    console.log('   - Note:', result.data.note);
  } else {
    console.log('❌ Private Key Pay and Validate Failed:', result.error);
  }
}

/**
 * Teste 5: Smart Wallet - Prepare Validate and Supply
 */
async function testSmartWalletValidateAndSupply() {
  console.log('🧪 Teste 5: Smart Wallet - Prepare Validate and Supply');
  
  const message = `Validate and supply amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createSmartWalletSignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/benqi-validation/validateAndSupply', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7',
    isSmartWallet: true,
    walletType: 'smart_wallet'
  });
  
  if (result.success) {
    console.log('✅ Smart Wallet Validate and Supply OK:', result.data);
    console.log('   - Wallet Type:', result.data.walletType);
    console.log('   - Requires Signature:', result.data.requiresSignature);
    console.log('   - Note:', result.data.note);
  } else {
    console.log('❌ Smart Wallet Validate and Supply Failed:', result.error);
  }
}

/**
 * Teste 6: Private Key - Execute Validate and Supply
 */
async function testPrivateKeyValidateAndSupply() {
  console.log('🧪 Teste 6: Private Key - Execute Validate and Supply');
  
  const message = `Validate and supply amount 1000000000000000000\nTimestamp: ${Date.now()}`;
  const signature = await createPrivateKeySignature(message);
  
  const result = await makeAuthenticatedRequest('POST', '/benqi-validation/validateAndSupply', {
    address: SMART_WALLET_ADDRESS,
    signature,
    message,
    timestamp: Date.now(),
    amount: '1000000000000000000',
    qTokenAddress: '0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7',
    privateKey: PRIVATE_KEY
  });
  
  if (result.success) {
    console.log('✅ Private Key Validate and Supply OK:', result.data);
    console.log('   - Wallet Type:', result.data.walletType);
    console.log('   - Requires Signature:', result.data.requiresSignature);
    console.log('   - Note:', result.data.note);
  } else {
    console.log('❌ Private Key Validate and Supply Failed:', result.error);
  }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log('🚀 Iniciando testes de Smart Wallet vs Private Key...\n');
  
  try {
    // Testes de validação
    await testSmartWalletCalculateTax();
    console.log('');
    
    await testPrivateKeyCalculateTax();
    console.log('');
    
    await testSmartWalletPayAndValidate();
    console.log('');
    
    await testPrivateKeyPayAndValidate();
    console.log('');
    
    // Testes de Benqi
    await testSmartWalletValidateAndSupply();
    console.log('');
    
    await testPrivateKeyValidateAndSupply();
    console.log('');
    
    console.log('🎉 Todos os testes foram concluídos!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  }
}

// Executa os testes se o arquivo for chamado diretamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testSmartWalletCalculateTax,
  testPrivateKeyCalculateTax,
  testSmartWalletPayAndValidate,
  testPrivateKeyPayAndValidate,
  testSmartWalletValidateAndSupply,
  testPrivateKeyValidateAndSupply,
  runAllTests
};
