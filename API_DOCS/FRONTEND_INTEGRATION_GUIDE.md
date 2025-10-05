# 🎨 Guia de Integração Frontend

Este guia explica como integrar a API Panorama Block Backend com aplicações frontend.

## 🏗️ Arquitetura Frontend

```
Frontend App
    ↓
Frontend API (Porta 3002)
    ↓
Backend API (Porta 3001)
    ↓
Blockchain (Avalanche)
```

## 🔐 Autenticação com Smart Wallet

### 1. Configurar Wallet (MetaMask)

### 2. Criar Assinatura

```javascript
const createSignature = async (address, method, endpoint) => {
  const message = `${method} ${endpoint}\nTimestamp: ${Date.now()}`;
  
  try {
    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    return {
      address,
      signature,
      message,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    throw error;
  }
};
```

## 💰 Integração com Lending

### 1. Listar qTokens Disponíveis

```javascript
const getQTokens = async () => {
  try {
    const response = await fetch('http://localhost:3002/lending/qtokens');
    const data = await response.json();
    
    if (data.success) {
      return data.data.qTokens;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao obter qTokens:', error);
    throw error;
  }
};
```

### 2. Preparar Transação de Validação + Supply

```javascript
const prepareValidationSupply = async (walletAddress, qTokenAddress, amount) => {
  try {
    // Criar assinatura
    const authData = await createSignature(
      walletAddress, 
      'POST', 
      '/lending/validate-supply'
    );
    
    // Fazer requisição
    const response = await fetch('http://localhost:3002/lending/validate-supply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.transaction;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao preparar supply:', error);
    throw error;
  }
};
```

### 3. Executar Transação

```javascript
const executeTransaction = async (transaction) => {
  try {
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction]
    });
    
    console.log('Transação enviada:', txHash);
    return txHash;
  } catch (error) {
    console.error('Erro ao executar transação:', error);
    throw error;
  }
};
```

## 🔄 Integração com Swap

### 1. Listar Tokens Disponíveis

```javascript
const getTokens = async () => {
  try {
    const response = await fetch('http://localhost:3002/swap/tokens');
    const data = await response.json();
    
    if (data.success) {
      return data.data.tokens;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao obter tokens:', error);
    throw error;
  }
};
```

### 2. Obter Cotação de Validação + Swap

```javascript
const getValidationSwapQuote = async (walletAddress, tokenIn, tokenOut, amountIn) => {
  try {
    // Criar assinatura
    const authData = await createSignature(
      walletAddress, 
      'POST', 
      '/swap/validate-quote'
    );
    
    // Fazer requisição
    const response = await fetch('http://localhost:3002/swap/validate-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authData,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.quote;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao obter cotação:', error);
    throw error;
  }
};
```

### 3. Preparar Transação de Validação + Swap

```javascript
const prepareValidationSwap = async (walletAddress, tokenIn, tokenOut, amountIn, minAmountOut) => {
  try {
    // Criar assinatura
    const authData = await createSignature(
      walletAddress, 
      'POST', 
      '/swap/validate-swap'
    );
    
    // Fazer requisição
    const response = await fetch('http://localhost:3002/swap/validate-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authData,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.transaction;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao preparar swap:', error);
    throw error;
  }
};
```

## ✅ Integração com Validation

### 1. Verificar Status do Sistema

```javascript
const getValidationStatus = async () => {
  try {
    const response = await fetch('http://localhost:3002/validation/status');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao obter status:', error);
    throw error;
  }
};
```

### 2. Calcular Taxa

```javascript
const calculateTax = async (walletAddress, amount) => {
  try {
    // Criar assinatura
    const authData = await createSignature(
      walletAddress, 
      'POST', 
      '/validation/calculate'
    );
    
    // Fazer requisição
    const response = await fetch('http://localhost:3002/validation/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authData,
        amount: amount.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Erro ao calcular taxa:', error);
    throw error;
  }
};
```

## 🎯 Exemplo Completo: Supply com Validação

```javascript
class PanoramaLending {
  constructor(apiUrl = 'http://localhost:3002') {
    this.apiUrl = apiUrl;
    this.walletAddress = null;
  }
  
  // Conectar wallet
  async connectWallet() {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask não está instalado');
    }
    
    const accounts = await ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    this.walletAddress = accounts[0];
    return this.walletAddress;
  }
  
  // Criar assinatura
  async createSignature(method, endpoint) {
    const message = `${method} ${endpoint}\nTimestamp: ${Date.now()}`;
    
    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, this.walletAddress]
    });
    
    return {
      address: this.walletAddress,
      signature,
      message,
      timestamp: Date.now()
    };
  }
  
  // Fazer requisição autenticada
  async makeAuthenticatedRequest(method, endpoint, data = {}) {
    const authData = await this.createSignature(method, endpoint);
    
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authData, ...data })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.data;
  }
  
  // Listar qTokens
  async getQTokens() {
    const response = await fetch(`${this.apiUrl}/lending/qtokens`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error.message);
    }
    
    return data.data.qTokens;
  }
  
  // Preparar supply com validação
  async prepareValidationSupply(qTokenAddress, amount) {
    return await this.makeAuthenticatedRequest(
      'POST',
      '/lending/validate-supply',
      { qTokenAddress, amount: amount.toString() }
    );
  }
  
  // Executar transação
  async executeTransaction(transaction) {
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction]
    });
    
    return txHash;
  }
  
  // Supply completo com validação
  async supplyWithValidation(qTokenAddress, amount) {
    try {
      // 1. Preparar transação
      const { transaction } = await this.prepareValidationSupply(qTokenAddress, amount);
      
      // 2. Executar transação
      const txHash = await this.executeTransaction(transaction);
      
      console.log('Supply executado:', txHash);
      return txHash;
      
    } catch (error) {
      console.error('Erro no supply:', error);
      throw error;
    }
  }
}

// Uso
const lending = new PanoramaLending();

// Conectar wallet
await lending.connectWallet();

// Listar qTokens
const qTokens = await lending.getQTokens();
console.log('qTokens disponíveis:', qTokens);

// Fazer supply com validação
const qAVAXAddress = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
const amount = '1000000000000000000'; // 1 AVAX

const txHash = await lending.supplyWithValidation(qAVAXAddress, amount);
console.log('Transação:', txHash);
```

## 🔧 Configuração de Desenvolvimento

### 1. Variáveis de Ambiente

```env
# .env.local
REACT_APP_API_URL=http://localhost:3002
REACT_APP_NETWORK_NAME=Avalanche C-Chain
REACT_APP_CHAIN_ID=43114
```

### 2. Configuração do Network

```javascript
// Adicionar Avalanche C-Chain ao MetaMask
const avalancheNetwork = {
  chainId: '0xa86a', // 43114
  chainName: 'Avalanche C-Chain',
  rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
  nativeCurrency: {
    name: 'AVAX',
    symbol: 'AVAX',
    decimals: 18
  },
  blockExplorerUrls: ['https://snowtrace.io']
};

// Adicionar network
await ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [avalancheNetwork]
});
```

### 3. Tratamento de Erros

```javascript
const handleApiError = (error) => {
  if (error.message.includes('User rejected')) {
    return 'Transação cancelada pelo usuário';
  } else if (error.message.includes('insufficient funds')) {
    return 'Saldo insuficiente';
  } else if (error.message.includes('Network error')) {
    return 'Erro de rede. Tente novamente.';
  } else {
    return 'Erro desconhecido: ' + error.message;
  }
};
```

## 📱 Exemplo com React

```jsx
import React, { useState, useEffect } from 'react';

const LendingComponent = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [qTokens, setQTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Conectar wallet
  const connectWallet = async () => {
    try {
      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      setWalletAddress(accounts[0]);
    } catch (error) {
      console.error('Erro ao conectar wallet:', error);
    }
  };
  
  // Carregar qTokens
  useEffect(() => {
    const loadQTokens = async () => {
      try {
        const response = await fetch('http://localhost:3002/lending/qtokens');
        const data = await response.json();
        
        if (data.success) {
          setQTokens(data.data.qTokens);
        }
      } catch (error) {
        console.error('Erro ao carregar qTokens:', error);
      }
    };
    
    loadQTokens();
  }, []);
  
  // Fazer supply
  const handleSupply = async (qTokenAddress, amount) => {
    setLoading(true);
    
    try {
      // Criar assinatura
      const message = `POST /lending/validate-supply\nTimestamp: ${Date.now()}`;
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress]
      });
      
      // Preparar transação
      const response = await fetch('http://localhost:3002/lending/validate-supply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          signature,
          message,
          timestamp: Date.now(),
          qTokenAddress,
          amount: amount.toString()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Executar transação
        const txHash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [data.data.transaction]
        });
        
        console.log('Transação enviada:', txHash);
        alert('Supply executado com sucesso!');
      } else {
        throw new Error(data.error.message);
      }
      
    } catch (error) {
      console.error('Erro no supply:', error);
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h1>Panorama Lending</h1>
      
      {!walletAddress ? (
        <button onClick={connectWallet}>
          Conectar Wallet
        </button>
      ) : (
        <div>
          <p>Wallet: {walletAddress}</p>
          
          <h2>qTokens Disponíveis</h2>
          {qTokens.map(token => (
            <div key={token.address}>
              <h3>{token.symbol}</h3>
              <p>{token.name}</p>
              <button 
                onClick={() => handleSupply(token.address, '1000000000000000000')}
                disabled={loading}
              >
                {loading ? 'Processando...' : 'Fazer Supply'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LendingComponent;
```

## 🚨 Boas Práticas

1. **Sempre verificar se o wallet está conectado**
2. **Tratar erros de forma amigável**
3. **Mostrar loading durante operações**
4. **Validar dados antes de enviar**
5. **Usar try/catch para capturar erros**
6. **Testar em ambiente de desenvolvimento primeiro**

## 🔗 Links Úteis

- [Documentação da API](./API_DOCUMENTATION.md)
- [Testes](./TESTS.md)
- [MetaMask Docs](https://docs.metamask.io/)
- [Avalanche Docs](https://docs.avax.network/)
- [Ethers.js Docs](https://docs.ethers.io/)
