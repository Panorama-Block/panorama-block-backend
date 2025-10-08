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

// Função para testar endpoint de informações
async function testValidationInfo() {
  console.log('🔍 Testando endpoint /validation/info...');
  
  const timestamp = Date.now();
  const message = `Get validation info\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  
  try {
    const response = await axios.get(`${API_URL}/validation/info`, {
      data: {
        address: WALLET_ADDRESS,
        signature: signature,
        message: message,
        timestamp: timestamp
      }
    });
    
    console.log('✅ Resposta do /validation/info:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no /validation/info:');
    console.log(error.response?.data || error.message);
  }
}

// Função para testar endpoint de cálculo
async function testValidationCalculate() {
  console.log('\n🧮 Testando endpoint /validation/calculate...');
  
  const timestamp = Date.now();
  const message = `Calculate tax\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  const amount = '1000000000000000000'; // 1 AVAX em wei
  
  try {
    const response = await axios.post(`${API_URL}/validation/calculate`, {
      address: WALLET_ADDRESS,
      signature: signature,
      message: message,
      timestamp: timestamp,
      amount: amount
    });
    
    console.log('✅ Resposta do /validation/calculate:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no /validation/calculate:');
    console.log(error.response?.data || error.message);
  }
}

// Função para testar endpoint de saldo
async function testValidationBalance() {
  console.log('\n💰 Testando endpoint /validation/balance...');
  
  const timestamp = Date.now();
  const message = `Get contract balance\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  
  try {
    const response = await axios.get(`${API_URL}/validation/balance`, {
      data: {
        address: WALLET_ADDRESS,
        signature: signature,
        message: message,
        timestamp: timestamp
      }
    });
    
    console.log('✅ Resposta do /validation/balance:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no /validation/balance:');
    console.log(error.response?.data || error.message);
  }
}

// Função para testar endpoint de preparação de transação
async function testValidationPrepare() {
  console.log('\n🔧 Testando endpoint /validation/prepare...');
  
  const timestamp = Date.now();
  const message = `Prepare transaction\nTimestamp: ${timestamp}`;
  const signature = await createSignature(message);
  
  try {
    const response = await axios.post(`${API_URL}/validation/prepare`, {
      address: WALLET_ADDRESS,
      signature: signature,
      message: message,
      timestamp: timestamp,
      functionName: 'setTaxRate',
      params: ['15']
    });
    
    console.log('✅ Resposta do /validation/prepare:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no /validation/prepare:');
    console.log(error.response?.data || error.message);
  }
}

// Função principal
async function runTests() {
  console.log('🚀 Iniciando testes da API Validation...');
  console.log(`📍 Endereço da wallet: ${WALLET_ADDRESS}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('');
  
  await testValidationInfo();
  await testValidationCalculate();
  await testValidationBalance();
  await testValidationPrepare();
  
  console.log('\n✨ Testes concluídos!');
}

// Executa os testes
runTests().catch(console.error);