# 🚀 Exemplos Práticos - API de Lending Benqi

## 📋 Índice
1. [Configuração Inicial](#configuração-inicial)
2. [Exemplos de Autenticação](#exemplos-de-autenticação)
3. [Operações Básicas](#operações-básicas)
4. [Operações com Validação](#operações-com-validação)
5. [Tratamento de Erros](#tratamento-de-erros)
6. [Exemplos Avançados](#exemplos-avançados)

## 🔧 Configuração Inicial

### 1. Instalação de Dependências
```bash
npm install axios ethers dotenv
```

### 2. Configuração do Ambiente
```javascript
// .env
RPC_URL=https://api.avax.network/ext/bc/C/rpc
PRIVATE_KEY=0x1234567890abcdef...
API_BASE_URL=http://localhost:3001
```

### 3. Configuração do Cliente
```javascript
const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Criar provider e wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
```

## 🔐 Exemplos de Autenticação

### 1. Autenticação Smart Wallet
```javascript
async function createSignature(message) {
  const signature = await wallet.signMessage(message);
  return {
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now()
  };
}

// Exemplo de uso
const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
const authData = await createSignature(message);
```

### 2. Autenticação com Private Key
```javascript
const requestData = {
  privateKey: PRIVATE_KEY,
  // ... outros parâmetros
};
```

## 💼 Operações Básicas

### 1. Listar qTokens Disponíveis
```javascript
async function getQTokens() {
  try {
    const response = await axios.get(`${API_BASE_URL}/benqi/qtokens`);
    console.log('qTokens disponíveis:', response.data.data.qTokens);
    return response.data.data.qTokens;
  } catch (error) {
    console.error('Erro ao listar qTokens:', error.response?.data || error.message);
  }
}

// Uso
getQTokens();
```

### 2. Supply de Ativos
```javascript
async function supplyAsset(qTokenAddress, amount) {
  try {
    const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/supply`, {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Transação de supply preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no supply:', error.response?.data || error.message);
  }
}

// Exemplo: Supply de 1 AVAX
const qAVAX = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
const amount = ethers.parseEther('1.0');
supplyAsset(qAVAX, amount);
```

### 3. Redeem de qTokens
```javascript
async function redeemTokens(qTokenAddress, amount, isUnderlying = true) {
  try {
    const message = `POST /benqi/redeem\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/redeem`, {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString(),
      isUnderlying: isUnderlying
    });
    
    console.log('Transação de redeem preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no redeem:', error.response?.data || error.message);
  }
}

// Exemplo: Redeem de 1 qAVAX
redeemTokens(qAVAX, amount, true);
```

### 4. Borrow de Ativos
```javascript
async function borrowAsset(qTokenAddress, amount) {
  try {
    const message = `POST /benqi/borrow\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/borrow`, {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Transação de borrow preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no borrow:', error.response?.data || error.message);
  }
}

// Exemplo: Borrow de 0.5 AVAX
const borrowAmount = ethers.parseEther('0.5');
borrowAsset(qAVAX, borrowAmount);
```

### 5. Repay de Empréstimo
```javascript
async function repayLoan(qTokenAddress, amount) {
  try {
    const message = `POST /benqi/repay\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/repay`, {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Transação de repay preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no repay:', error.response?.data || error.message);
  }
}

// Exemplo: Repay de 0.5 AVAX
repayLoan(qAVAX, borrowAmount);
```

### 6. Enter Markets
```javascript
async function enterMarkets(qTokenAddresses) {
  try {
    const message = `POST /benqi/enterMarkets\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/enterMarkets`, {
      ...authData,
      qTokenAddresses: qTokenAddresses
    });
    
    console.log('Transação de enterMarkets preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no enterMarkets:', error.response?.data || error.message);
  }
}

// Exemplo: Entrar em mercados AVAX e USDC
const qUSDC = '0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77';
enterMarkets([qAVAX, qUSDC]);
```

### 7. Exit Market
```javascript
async function exitMarket(qTokenAddress) {
  try {
    const message = `POST /benqi/exitMarket\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/exitMarket`, {
      ...authData,
      qTokenAddress: qTokenAddress
    });
    
    console.log('Transação de exitMarket preparada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro no exitMarket:', error.response?.data || error.message);
  }
}

// Exemplo: Sair do mercado AVAX
exitMarket(qAVAX);
```

## 🔒 Operações com Validação

### 1. Validate and Supply
```javascript
async function validateAndSupply(qTokenAddress, amount) {
  try {
    const response = await axios.post(`${API_BASE_URL}/benqi-validation/validateAndSupply`, {
      privateKey: PRIVATE_KEY,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Validação + Supply executado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro na validação + supply:', error.response?.data || error.message);
  }
}

// Exemplo: Validar e fazer supply de 1 AVAX
validateAndSupply(qAVAX, amount);
```

### 2. Validate and Redeem
```javascript
async function validateAndRedeem(qTokenAddress, amount, isUnderlying = true) {
  try {
    const response = await axios.post(`${API_BASE_URL}/benqi-validation/validateAndRedeem`, {
      privateKey: PRIVATE_KEY,
      qTokenAddress: qTokenAddress,
      amount: amount.toString(),
      isUnderlying: isUnderlying
    });
    
    console.log('Validação + Redeem executado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro na validação + redeem:', error.response?.data || error.message);
  }
}

// Exemplo: Validar e fazer redeem de 1 qAVAX
validateAndRedeem(qAVAX, amount, true);
```

### 3. Validate and Borrow
```javascript
async function validateAndBorrow(qTokenAddress, amount) {
  try {
    const response = await axios.post(`${API_BASE_URL}/benqi-validation/validateAndBorrow`, {
      privateKey: PRIVATE_KEY,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Validação + Borrow executado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro na validação + borrow:', error.response?.data || error.message);
  }
}

// Exemplo: Validar e fazer borrow de 0.5 AVAX
validateAndBorrow(qAVAX, borrowAmount);
```

### 4. Validate and Repay
```javascript
async function validateAndRepay(qTokenAddress, amount) {
  try {
    const response = await axios.post(`${API_BASE_URL}/benqi-validation/validateAndRepay`, {
      privateKey: PRIVATE_KEY,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    console.log('Validação + Repay executado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro na validação + repay:', error.response?.data || error.message);
  }
}

// Exemplo: Validar e fazer repay de 0.5 AVAX
validateAndRepay(qAVAX, borrowAmount);
```

## 🚨 Tratamento de Erros

### 1. Função de Tratamento de Erros
```javascript
function handleApiError(error, operation) {
  if (error.response) {
    // Erro da API
    const { status, data } = error.response;
    console.error(`Erro ${status} em ${operation}:`, data);
    
    switch (status) {
      case 400:
        console.error('Dados inválidos:', data.error?.message);
        break;
      case 401:
        console.error('Autenticação falhou:', data.error?.message);
        break;
      case 429:
        console.error('Rate limit excedido:', data.error?.message);
        break;
      case 500:
        console.error('Erro interno do servidor:', data.error?.message);
        break;
      default:
        console.error('Erro desconhecido:', data);
    }
  } else if (error.request) {
    // Erro de rede
    console.error('Erro de rede em', operation, ':', error.message);
  } else {
    // Outros erros
    console.error('Erro em', operation, ':', error.message);
  }
}
```

### 2. Exemplo com Tratamento de Erros
```javascript
async function safeSupply(qTokenAddress, amount) {
  try {
    const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
    const authData = await createSignature(message);
    
    const response = await axios.post(`${API_BASE_URL}/benqi/supply`, {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    handleApiError(error, 'supply');
    return { success: false, error: error.message };
  }
}
```

## 🚀 Exemplos Avançados

### 1. Classe Completa para Interação com API
```javascript
class BenqiApiClient {
  constructor(apiBaseUrl, privateKey, rpcUrl) {
    this.apiBaseUrl = apiBaseUrl;
    this.privateKey = privateKey;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async createSignature(message) {
    const signature = await this.wallet.signMessage(message);
    return {
      address: this.wallet.address,
      signature: signature,
      message: message,
      timestamp: Date.now()
    };
  }

  async makeRequest(method, endpoint, data = {}) {
    try {
      const response = await axios({
        method: method.toLowerCase(),
        url: `${this.apiBaseUrl}${endpoint}`,
        data: data,
        headers: { 'Content-Type': 'application/json' }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getQTokens() {
    return await this.makeRequest('GET', '/benqi/qtokens');
  }

  async supply(qTokenAddress, amount) {
    const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
    const authData = await this.createSignature(message);
    
    return await this.makeRequest('POST', '/benqi/supply', {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
  }

  async redeem(qTokenAddress, amount, isUnderlying = true) {
    const message = `POST /benqi/redeem\nTimestamp: ${Date.now()}`;
    const authData = await this.createSignature(message);
    
    return await this.makeRequest('POST', '/benqi/redeem', {
      ...authData,
      qTokenAddress: qTokenAddress,
      amount: amount.toString(),
      isUnderlying: isUnderlying
    });
  }

  async validateAndSupply(qTokenAddress, amount) {
    return await this.makeRequest('POST', '/benqi-validation/validateAndSupply', {
      privateKey: this.privateKey,
      qTokenAddress: qTokenAddress,
      amount: amount.toString()
    });
  }
}

// Uso da classe
const client = new BenqiApiClient(
  'http://localhost:3001',
  process.env.PRIVATE_KEY,
  process.env.RPC_URL
);

// Exemplos de uso
async function examples() {
  // Listar qTokens
  const qTokens = await client.getQTokens();
  console.log('qTokens:', qTokens);

  // Supply de 1 AVAX
  const supplyResult = await client.supply(
    '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    ethers.parseEther('1.0')
  );
  console.log('Supply result:', supplyResult);

  // Validação + Supply
  const validateSupplyResult = await client.validateAndSupply(
    '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    ethers.parseEther('1.0')
  );
  console.log('Validate + Supply result:', validateSupplyResult);
}
```

### 2. Exemplo de Fluxo Completo
```javascript
async function completeLendingFlow() {
  console.log('🚀 Iniciando fluxo completo de lending...');
  
  try {
    // 1. Listar qTokens disponíveis
    console.log('📋 1. Listando qTokens...');
    const qTokensResult = await client.getQTokens();
    if (!qTokensResult.success) {
      throw new Error('Falha ao listar qTokens');
    }
    console.log('✅ qTokens listados:', qTokensResult.data.data.total);

    // 2. Entrar em mercados
    console.log('📋 2. Entrando em mercados...');
    const qAVAX = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
    const enterMarketsResult = await client.enterMarkets([qAVAX]);
    if (!enterMarketsResult.success) {
      throw new Error('Falha ao entrar em mercados');
    }
    console.log('✅ Entrou em mercados');

    // 3. Supply de AVAX
    console.log('📋 3. Fazendo supply de AVAX...');
    const supplyResult = await client.supply(qAVAX, ethers.parseEther('1.0'));
    if (!supplyResult.success) {
      throw new Error('Falha no supply');
    }
    console.log('✅ Supply realizado');

    // 4. Borrow de USDC
    console.log('📋 4. Fazendo borrow de USDC...');
    const qUSDC = '0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77';
    const borrowResult = await client.borrow(qUSDC, ethers.parseUnits('100', 6)); // 100 USDC
    if (!borrowResult.success) {
      throw new Error('Falha no borrow');
    }
    console.log('✅ Borrow realizado');

    console.log('🎉 Fluxo completo de lending executado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no fluxo de lending:', error.message);
  }
}
```

### 3. Monitoramento e Logs
```javascript
class BenqiApiClientWithLogging extends BenqiApiClient {
  constructor(apiBaseUrl, privateKey, rpcUrl) {
    super(apiBaseUrl, privateKey, rpcUrl);
    this.operationCount = 0;
    this.startTime = Date.now();
  }

  async makeRequest(method, endpoint, data = {}) {
    this.operationCount++;
    const startTime = Date.now();
    
    console.log(`[${this.operationCount}] ${method} ${endpoint} - Iniciando...`);
    
    const result = await super.makeRequest(method, endpoint, data);
    
    const duration = Date.now() - startTime;
    const status = result.success ? '✅' : '❌';
    
    console.log(`[${this.operationCount}] ${status} ${method} ${endpoint} - ${duration}ms`);
    
    if (!result.success) {
      console.error(`[${this.operationCount}] Erro:`, result.error);
    }
    
    return result;
  }

  getStats() {
    const totalTime = Date.now() - this.startTime;
    return {
      operations: this.operationCount,
      totalTime: totalTime,
      averageTime: totalTime / this.operationCount
    };
  }
}
```

## 📚 Recursos Adicionais

### 1. Constantes Úteis
```javascript
const BENQI_CONSTANTS = {
  QTOKENS: {
    QAVAX: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    QUSDC: '0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77',
    QUSDT: '0xCde5A11a4ACB4eE4c805352Cec57E236bdBC3837',
    QDAI: '0x835866d37afb8cb8f8334dccdaf66cf01832ffcf',
    QWETH: '0x334ad834cd4481bb02d09615e7c11a00579a7909'
  },
  DECIMALS: {
    AVAX: 18,
    USDC: 6,
    USDT: 6,
    DAI: 18,
    WETH: 18
  }
};
```

### 2. Utilitários
```javascript
function formatAmount(amount, decimals) {
  return ethers.formatUnits(amount, decimals);
}

function parseAmount(amount, decimals) {
  return ethers.parseUnits(amount, decimals);
}

function getQTokenAddress(symbol) {
  return BENQI_CONSTANTS.QTOKENS[symbol.toUpperCase()];
}
```

---

**Versão**: 1.0.0  
**Última atualização**: Setembro 2025  
**Rede**: Avalanche C-Chain (43114)
