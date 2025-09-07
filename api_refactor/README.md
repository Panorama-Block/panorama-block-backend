# 🚀 API Trader Joe - Avalanche

API simples para interagir com o Trader Joe DEX no Avalanche usando private key.

## 📋 Pré-requisitos

- Node.js
- Private key com saldo de WAVAX/AVAX
- Arquivo `.env` configurado

## ⚙️ Configuração

1. Instale as dependências:
```bash
npm install
```

2. Configure o arquivo `.env`:
```bash
cp env.example .env
```

3. Edite o `.env` com sua private key (apenas para testes):
```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Nota**: A private key é usada apenas para gerar assinaturas nos testes. Em produção, o frontend deve assinar as mensagens com a wallet do usuário.

## 🧪 Teste Básico

Execute o teste de swap:
```bash
node test.js
```

Este teste faz:
- ✅ Verifica saldos (AVAX, WAVAX, USDT)
- ✅ Obtém preço atual WAVAX → USDT
- ✅ Prepara dados de swap para assinatura
- ✅ **Executa transações reais** nos últimos 3 testes (swap, add/remove liquidity)
- ✅ Testa todas as rotas da API com autenticação por assinatura
- ✅ Mostra resultados e saldos finais

**Nota**: Os últimos 3 testes (swap, add/remove liquidity) executam transações reais na blockchain usando a private key do `.env` para demonstração. Em produção, o frontend deve assinar e executar as transações.

## 🚀 Iniciar API

```bash
npm start
```

A API estará disponível em `http://localhost:3001`

## 📚 Endpoints Disponíveis

### 🔐 Autenticação
Todos os endpoints protegidos requerem:
```json
{
  "address": "0x1234...",           // Endereço da wallet
  "signature": "0xabcd...",         // Assinatura da mensagem
  "message": "Execute swap...",     // Mensagem assinada
  "timestamp": 1234567890           // Timestamp da mensagem
}
```

### GET `/health`
Verifica se a API está funcionando.
**Retorna:** `{ "status": "ok" }`

### GET `/info`
Informações sobre a API.
**Retorna:** Informações da API

### GET `/dex/network-status`
Status da rede Avalanche.
**Retorna:** Status da rede

### GET `/dex/config`
Configurações atuais.
**Retorna:** Configurações da API

### GET `/dex/getprice?dexId=2100&path=WAVAX,USDT&amountIn=1000000000000000`
Obtém preço de swap.
**Retorna:** Preço estimado do swap

### POST `/dex/swap`
Prepara dados de swap para assinatura no frontend.

**Body:**
```json
{
  "address": "0x1234...",
  "signature": "0xabcd...",
  "message": "Execute swap WAVAX to USDT\nTimestamp: 1234567890",
  "timestamp": 1234567890,
  "dexId": "2100",
  "path": "WAVAX,USDT",
  "amountIn": "1000000000000000",
  "slippage": 90,
  "gasPriority": "medium"
}
```

**Retorna:**
```json
{
  "status": 200,
  "msg": "success",
  "data": {
    "chainId": "43114",
    "from": "0x1234...",
    "to": "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
    "value": "1000000000000000",
    "gas": "600000",
    "data": "0xa2a1623d...",
    "gasPrice": "30000000000",
    "referenceId": "abc123",
    "status": "ready_for_signature",
    "note": "Transação preparada para assinatura no frontend"
  }
}
```

**No Frontend:** Use `wallet.sendTransaction(txData)` para executar a transação.

## 🎯 Implementação no Frontend

### 1. Autenticação
```javascript
// Gerar assinatura
const message = `Execute swap WAVAX to USDT\nTimestamp: ${Date.now()}`;
const signature = await wallet.signMessage(message);

// Enviar para API
const authData = {
  address: wallet.address,
  signature: signature,
  message: message,
  timestamp: Date.now()
};
```

### 2. Executar Transação
```javascript
// Chamar API
const response = await fetch('/dex/swap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...authData,
    dexId: '2100',
    path: 'WAVAX,USDT',
    amountIn: '1000000000000000',
    slippage: 90
  })
});

const result = await response.json();

// Executar transação
if (result.status === 200) {
  const txData = {
    to: result.data.to,
    value: result.data.value,
    data: result.data.data,
    gasLimit: result.data.gas,
    gasPrice: result.data.gasPrice
  };
  
  const tx = await wallet.sendTransaction(txData);
  const receipt = await tx.wait();
  
  console.log('Transação executada:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
}
```

### POST `/dex/addliquidity`
Prepara dados para adicionar liquidez.

**Body:**
```json
{
  "address": "0x1234...",
  "signature": "0xabcd...",
  "message": "Add liquidity WAVAX/USDT\nTimestamp: 1234567890",
  "timestamp": 1234567890,
  "dexId": "2100",
  "tokenA": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  "tokenB": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  "amountA": "1000000000000000",
  "amountB": "25000",
  "amountAMin": "900000000000000",
  "amountBMin": "22500",
  "deadline": "1234567890",
  "to": "0x1234...",
  "from": "0x1234...",
  "gas": "530000",
  "gasPriority": "medium",
  "slippage": 90
}
```

**Retorna:** Mesmo formato do swap, mas com dados de adição de liquidez.

**No Frontend:** Use `wallet.sendTransaction(txData)` para executar a transação.

### POST `/dex/removeliquidity`
Prepara dados para remover liquidez.

**Body:**
```json
{
  "address": "0x1234...",
  "signature": "0xabcd...",
  "message": "Remove liquidity WAVAX/USDT\nTimestamp: 1234567890",
  "timestamp": 1234567890,
  "dexId": "2100",
  "tokenA": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  "tokenB": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  "amountAMin": "900000000000000",
  "amountBMin": "22500",
  "deadline": "1234567890",
  "from": "0x1234...",
  "to": "0x1234...",
  "gas": "500000",
  "gasPriority": "medium",
  "binStep": "25",
  "ids": ["1"],
  "amounts": ["1000000000000000"],
  "slippage": 90
}
```

**Retorna:** Mesmo formato do swap, mas com dados de remoção de liquidez.

**No Frontend:** Use `wallet.sendTransaction(txData)` para executar a transação.

### GET `/dex/getuserliquidity`
Obtém liquidez do usuário.
**Retorna:** Liquidez do usuário nos pools

### GET `/dex/getpoolliquidity`
Obtém liquidez do pool.
**Retorna:** Liquidez total do pool

### GET `/dex/gettokenliquidity`
Obtém liquidez de um token.
**Retorna:** Liquidez de um token específico

### GET `/dex/tokens`
Lista todos os tokens disponíveis na API.
**Retorna:** Lista completa de tokens com símbolos e endereços

### GET `/dex/tokens/:symbol`
Obtém o endereço de um token específico.
**Exemplo:** `/dex/tokens/WAVAX`
**Retorna:** Endereço do token solicitado

## 🪙 Gerenciamento de Tokens

### Adicionar Novos Tokens

**1. Via arquivo `.env`:**
```env
# Adicione no seu .env
NOVO_TOKEN_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
```

**2. Via código (runtime):**
```javascript
const { addToken } = require('./config/constants');

// Adicionar token dinamicamente
addToken('NOVO_TOKEN', '0x1234567890abcdef1234567890abcdef12345678');
```

**3. Listar tokens disponíveis:**
```bash
# Via API
curl http://localhost:3001/dex/tokens

# Via código
const { listTokens } = require('./config/constants');
console.log(listTokens());
```

### Tokens Pré-configurados
- **WAVAX, USDC, USDT** - Tokens principais
- **DAI, WETH, JOE** - Tokens DeFi
- **LINK, UNI** - Tokens de protocolos
- **AAVE, COMP, CRV** - Tokens DeFi avançados

## 🔧 Configurações do Swap

- **Slippage**: 90% (para garantir execução)
- **Gas Limit**: 600,000
- **Gas Price**: 30 gwei
- **Deadline**: 30 minutos

## 📝 Exemplo de Uso

```bash
# Teste básico
node test.js

# Iniciar API
npm start

# Testar endpoint
curl "http://localhost:3001/getprice?dexId=traderjoe&path=WAVAX,USDT&amountIn=1000000000000000"
```

## 🌐 Links Úteis

- **Snowtrace**: https://snowtrace.io
- **Trader Joe**: https://traderjoexyz.com
- **Avalanche**: https://avax.network

## ⚠️ Avisos

- **NUNCA** use sua private key real em produção
- **SEMPRE** teste com valores pequenos primeiro
- **VERIFIQUE** se tem saldo suficiente para gas
- **USE** apenas para testes e desenvolvimento
