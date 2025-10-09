const { ethers } = require('ethers');
const axios = require('axios');

// Configurações
const API_URL = 'http://localhost:3001';
const PRIVATE_KEY = '0xc790bfc81702d03c8d89077fdb5518d2e5321d096ff5986fd566dfbf7a6ef6c6';
const WALLET_ADDRESS = '0x6B509c04e3caA2207b8f2A60A067a8ddED03b8d0';

// Cria wallet
const wallet = new ethers.Wallet(PRIVATE_KEY);

// Função para criar assinatura
async function createSignature(message) {
  const signature = await wallet.signMessage(message);
  return signature;
}

// Função para testar cotação
async function testGetQuote() {
  console.log('💰 Testando cotação de validação + swap...');
  
  const timestamp = Date.now();
  const message = `Get validation and swap quote\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  
  const amount = '1000000000000000000'; // 1 AVAX em wei
  const tokenIn = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // WAVAX
  const tokenOut = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // USDC
  
  try {
    const response = await axios.post(`${API_URL}/validation-swap/getValidationAndSwapQuote`, {
      address: WALLET_ADDRESS,
      signature: signature,
      message: message,
      timestamp: timestamp,
      amount: amount,
      tokenIn: tokenIn,
      tokenOut: tokenOut
    });
    
    console.log('✅ Cotação obtida:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro na cotação:');
    console.log(error.response?.data || error.message);
  }
}

// Função para testar validação + swap
async function testValidateAndSwap() {
  console.log('\n🔄 Testando validação + swap...');
  
  const timestamp = Date.now();
  const message = `Validate and swap\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  
  const amount = '100000000000000000'; // 0.1 AVAX em wei (menor valor para teste)
  const tokenIn = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // WAVAX
  const tokenOut = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // USDC
  
  try {
    const response = await axios.post(`${API_URL}/validation-swap/validateAndSwap`, {
      address: WALLET_ADDRESS,
      signature: signature,
      message: message,
      timestamp: timestamp,
      amount: amount,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      privateKey: PRIVATE_KEY
    });
    
    console.log('✅ Validação + Swap executado:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro na validação + swap:');
    console.log(error.response?.data || error.message);
  }
}

// Função principal
async function runTests() {
  console.log('🚀 Testando API de Validação + Swap...');
  console.log(`📍 Endereço da wallet: ${WALLET_ADDRESS}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('');
  
  await testGetQuote();
  await testValidateAndSwap();
  
  console.log('\n✨ Testes concluídos!');
}

// Executa os testes
runTests().catch(console.error);
