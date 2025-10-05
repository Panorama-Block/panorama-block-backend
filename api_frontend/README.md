# 🚀 Panorama Frontend API

## 🎯 Visão Geral

A API Frontend do Panorama Block é uma interface simplificada e otimizada para usuários finais. Ela abstrai a complexidade do backend e oferece endpoints intuitivos para operações de lending, swap e validação.

## 🔧 Características

### ✅ **Interface Simplificada**
- Endpoints intuitivos e fáceis de usar
- Documentação clara e exemplos práticos
- Respostas padronizadas com instruções

### ✅ **Smart Wallet Integration**
- Autenticação por assinatura
- Preparação de transações para frontend
- Suporte completo a wallets conectados

### ✅ **Validação Automática**
- Sistema de validação integrado
- Cálculo automático de taxas
- Execução direta com private key

### ✅ **Rate Limiting Inteligente**
- Proteção contra abuso
- Limites diferenciados por tipo de operação
- Monitoramento em tempo real

## 📋 Endpoints Disponíveis

### 🏦 **Lending (`/lending/*`)**
- `GET /lending/qtokens` - Lista qTokens disponíveis
- `POST /lending/enter-markets` - Preparar enterMarkets
- `POST /lending/exit-market` - Preparar exitMarket
- `POST /lending/validate-supply` - Preparar transação de validação + supply (requer autenticação)
- `POST /lending/validate-redeem` - Preparar transação de validação + redeem (requer autenticação)
- `POST /lending/validate-borrow` - Preparar transação de validação + borrow (requer autenticação)
- `POST /lending/validate-repay` - Preparar transação de validação + repay (requer autenticação)

### 🔄 **Swap (`/swap/*`)**
- `GET /swap/price` - Obter preço de swap
- `GET /swap/quote` - Obter cotação completa
- `GET /swap/tokens` - Lista tokens disponíveis
- `POST /swap/validate-quote` - Obter cotação de validação + swap (requer autenticação)
- `POST /swap/validate-swap` - Preparar transação de validação + swap (requer autenticação)

### ✅ **Validation (`/validation/*`)**
- `GET /validation/info` - Informações do contrato
- `POST /validation/calculate` - Calcular taxa
- `POST /validation/pay` - Executar pagamento
- `GET /validation/status` - Status do sistema
- `POST /validation/validate-lending` - Validação + lending

## 🚀 Início Rápido

### 1. Instalação
```bash
cd api_frontend
npm install
```

### 2. Configuração
```bash
cp env.example .env
# Edite o .env com suas configurações
```

### 3. Execução
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

### 4. Teste
```bash
# Teste completo
npm test

# Teste específico
npm run test:benqi
npm run test:validation
```

## 🔐 Autenticação

### Smart Wallet (Recomendado)
```javascript
// 1. Criar mensagem para assinar
const message = `POST /lending/supply\nTimestamp: ${Date.now()}`;

// 2. Assinar mensagem no frontend
const signature = await wallet.signMessage(message);

// 3. Enviar requisição
const response = await fetch('/lending/supply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now(),
    qTokenAddress: qAVAX,
    amount: '1000000000000000000'
  })
});
```

### Execução Direta (Private Key)
```javascript
// Para operações que requerem execução direta
const response = await fetch('/validation/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    privateKey: process.env.PRIVATE_KEY,
    amount: '1000000000000000000'
  })
});
```

## 📊 Exemplos de Uso

### Exemplo 1: Supply de AVAX
```javascript
const { ethers } = require('ethers');

// 1. Conectar wallet
const wallet = new ethers.Wallet(PRIVATE_KEY);

// 2. Preparar dados
const qAVAX = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
const amount = ethers.parseEther('1.0');
const message = `POST /lending/supply\nTimestamp: ${Date.now()}`;
const signature = await wallet.signMessage(message);

// 3. Fazer requisição
const response = await fetch('http://localhost:3002/lending/supply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now(),
    qTokenAddress: qAVAX,
    amount: amount.toString()
  })
});

const result = await response.json();
console.log('Transação preparada:', result.data.transaction);
```

### Exemplo 2: Swap de AVAX para USDC
```javascript
// 1. Obter cotação
const quoteResponse = await fetch('http://localhost:3002/swap/quote?tokenIn=0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7&tokenOut=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E&amount=1000000000000000000');
const quote = await quoteResponse.json();

// 2. Preparar transação
const swapResponse = await fetch('http://localhost:3002/swap/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now(),
    tokenIn: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    tokenOut: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    amountIn: '1000000000000000000',
    minAmountOut: '100000000' // 100 USDC
  })
});

const swap = await swapResponse.json();
console.log('Swap preparado:', swap.data.transaction);
```

### Exemplo 3: Validação + Supply
```javascript
// Executar validação + supply em uma única operação
const response = await fetch('http://localhost:3002/validation/validate-lending', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    privateKey: process.env.PRIVATE_KEY,
    operation: 'supply',
    qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    amount: '1000000000000000000'
  })
});

const result = await response.json();
console.log('Validação + supply executado:', result.data.transaction);
```

## 🔧 Configuração

### Variáveis de Ambiente
```bash
# API Backend
BACKEND_API_URL=http://localhost:3001
BACKEND_TIMEOUT=30000

# Servidor Frontend
PORT=3002
NODE_ENV=development

# Segurança
JWT_SECRET=frontend_api_secret_key_2025
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Rede
NETWORK_NAME=Avalanche C-Chain
CHAIN_ID=43114
RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

## 📈 Monitoramento

### Health Check
```bash
curl http://localhost:3002/health
```

### Informações da API
```bash
curl http://localhost:3002/info
```

### Logs
- Todas as operações são logadas
- Logs incluem timestamp, endereço, operação e status
- Logs de erro incluem stack trace

## 🛡️ Segurança

### Rate Limiting
- **Lending**: 100 requests/15min
- **Swap**: 150 requests/15min
- **Validation**: 50 requests/15min

### Validação de Entrada
- Sanitização automática de endereços
- Validação de valores numéricos
- Verificação de formato de assinatura

### Autenticação
- Verificação de assinatura para operações sensíveis
- Timeout de 5 minutos para assinaturas
- Validação de endereço recuperado

## 🧪 Testes

### Teste Completo
```bash
node test-frontend.js
```

### Testes Específicos
```bash
# Teste de lending
node test-benqi-frontend.js

# Teste de validação
node test-validation-frontend.js
```

## 📚 Documentação

- **Backend API**: [Documentação do Backend](../api_backend/docs/README.md)
- **Exemplos**: [Exemplos Práticos](./examples/)
- **Suporte**: support@yourdomain.com

## 🔄 Arquitetura

```
Frontend API (Port 3002)
    ↓
Backend API (Port 3001)
    ↓
Avalanche Network
```

### Fluxo de Dados
1. **Frontend** → API Frontend (simplificação)
2. **API Frontend** → API Backend (processamento)
3. **API Backend** → Blockchain (execução)

---

**Versão**: 1.0.0  
**Última atualização**: Outubro 2025  
**Rede**: Avalanche C-Chain (43114)  
**Status**: ✅ Produção Ready
