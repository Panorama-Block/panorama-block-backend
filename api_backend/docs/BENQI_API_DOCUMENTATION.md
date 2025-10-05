# 📚 Documentação da API de Lending - Benqi Protocol

## 🎯 Visão Geral

A API de Lending do Benqi permite operações de empréstimo e fornecimento de liquidez no protocolo Benqi da rede Avalanche. A API suporta autenticação via smart wallet (assinatura) e execução direta com private key.

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# RPC da rede Avalanche
RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Private Key (opcional - para execução direta)
PRIVATE_KEY=0x...

# Endereços dos contratos Benqi (opcional - usa valores padrão)
BENQI_COMPTROLLER=0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c
BENQI_UNITROLLER=0xD7c4006d33DA2A0A8525791ed212bbCD7Aca763F
BENQI_ORACLE=0x4cC758Fc4d77C88d7105030d82B1740d6b7dFc6E
```

### Endereços dos Contratos (Mainnet)

```javascript
const BENQI_CONTRACTS = {
  COMPTROLLER: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  UNITROLLER: '0xD7c4006d33DA2A0A8525791ed212bbCD7Aca763F',
  ORACLE: '0x4cC758Fc4d77C88d7105030d82B1740d6b7dFc6E',
  QAVAX: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  QUSDC: '0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77',
  QUSDT: '0xCde5A11a4ACB4eE4c805352Cec57E236bdBC3837',
  QDAI: '0x835866d37afb8cb8f8334dccdaf66cf01832ffcf',
  QWETH: '0x334ad834cd4481bb02d09615e7c11a00579a7909',
  QBTC: '0x2f2c4b3e0f3a9b7f6e3a2f3a9b7f6e3a2f3a9b7f',
  QLINK: '0x4e9f683A27a6BdAD3FC2764003759277e936103e',
  QJOE: '0x4036cb0D6BF6b5F17Aa4e05191F86D4b1655b0d9',
  QQI: '0x545356e396350D40cDEa888ad73534517399BF96',
  QCOQ: '0x0eBfebD41e1eA83Be5e911cDCd2730a0CCEE344d'
};
```

## 🔐 Autenticação

### Smart Wallet (Recomendado)

Para operações que não requerem execução direta, use autenticação por assinatura:

```javascript
// 1. Criar mensagem para assinar
const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;

// 2. Assinar mensagem no frontend
const signature = await wallet.signMessage(message);

// 3. Enviar requisição com dados de autenticação
const requestData = {
  address: wallet.address,
  signature: signature,
  message: message,
  timestamp: Date.now(),
  // ... outros parâmetros da operação
};
```

### Execução Direta (Private Key)

Para operações que requerem execução direta (como validação + lending):

```javascript
const requestData = {
  privateKey: process.env.PRIVATE_KEY, // Opcional
  // ... outros parâmetros da operação
};
```

## 📋 Endpoints

### Base URL
```
http://localhost:3001
```

### 1. Informações Gerais

#### `GET /info`
Retorna informações sobre a API.

**Resposta:**
```json
{
  "name": "Zico Swap API",
  "version": "1.0.0",
  "supportedProtocols": ["Benqi Lending", "Benqi + Validation"],
  "endpoints": {
    "benqi": "/benqi/*",
    "benqiValidation": "/benqi-validation/*"
  }
}
```

#### `GET /health`
Verifica o status da API.

**Resposta:**
```json
{
  "status": "healthy",
  "network": "Avalanche C-Chain",
  "chainId": 43114
}
```

### 2. Rotas do Benqi (`/benqi/*`)

#### `GET /benqi/qtokens`
Lista todos os qTokens disponíveis.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "qTokens": [
      {
        "symbol": "qAVAX",
        "address": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
        "underlying": "AVAX"
      },
      {
        "symbol": "qUSDC",
        "address": "0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77",
        "underlying": "USDC"
      }
      // ... outros qTokens
    ]
  }
}
```

#### `POST /benqi/supply`
Prepara transação para fornecer ativos ao protocolo.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/supply\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
  "amount": "1000000000000000000"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "ready_for_signature",
    "note": "Transação preparada para assinatura no frontend",
    "to": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
    "data": "0x...",
    "gas": "300000",
    "gasPrice": "25000000000"
  }
}
```

#### `POST /benqi/redeem`
Prepara transação para resgatar qTokens.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/redeem\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
  "amount": "1000000000000000000",
  "isUnderlying": true
}
```

#### `POST /benqi/borrow`
Prepara transação para emprestar ativos.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/borrow\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
  "amount": "1000000000000000000"
}
```

#### `POST /benqi/repay`
Prepara transação para pagar empréstimo.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/repay\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
  "amount": "1000000000000000000"
}
```

#### `POST /benqi/enterMarkets`
Prepara transação para entrar em mercados.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/enterMarkets\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddresses": [
    "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c"
  ]
}
```

#### `POST /benqi/exitMarket`
Prepara transação para sair de um mercado.

**Parâmetros:**
```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "POST /benqi/exitMarket\nTimestamp: ...",
  "timestamp": 1234567890,
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c"
}
```

### 3. Rotas com Validação (`/benqi-validation/*`)

#### `POST /benqi-validation/validateAndSupply`
Executa validação + supply em uma única transação.

**Parâmetros:**
```json
{
  "privateKey": "0x...", // Obrigatório para execução direta
  "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
  "amount": "1000000000000000000"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "executed",
    "transactionHash": "0x...",
    "gasUsed": "250000",
    "validation": {
      "taxRate": "0.01",
      "taxAmount": "10000000000000000"
    },
    "supply": {
      "qToken": "qAVAX",
      "amount": "1000000000000000000"
    }
  }
}
```

#### `POST /benqi-validation/validateAndRedeem`
Executa validação + redeem em uma única transação.

#### `POST /benqi-validation/validateAndBorrow`
Executa validação + borrow em uma única transação.

#### `POST /benqi-validation/validateAndRepay`
Executa validação + repay em uma única transação.

## 🔒 Middleware de Segurança

### Rate Limiting
- **Benqi Routes**: 100 requests/minuto por IP
- **Benqi Validation Routes**: 50 requests/minuto por IP

### Validação de Entrada
- Sanitização automática de todos os inputs
- Validação de endereços Ethereum
- Validação de valores numéricos

### Autenticação
- Verificação de assinatura para rotas `/benqi/*`
- Verificação de private key para rotas `/benqi-validation/*`

## 📊 Códigos de Status

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 400 | Dados inválidos |
| 401 | Autenticação falhou |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

## 🚨 Tratamento de Erros

### Estrutura de Erro
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Endereço do qToken inválido",
    "details": "O endereço fornecido não é um contrato qToken válido"
  }
}
```

### Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| `INVALID_ADDRESS` | Endereço inválido |
| `INVALID_AMOUNT` | Valor inválido |
| `INSUFFICIENT_FUNDS` | Saldo insuficiente |
| `INVALID_SIGNATURE` | Assinatura inválida |
| `RATE_LIMIT_EXCEEDED` | Rate limit excedido |
| `CONTRACT_ERROR` | Erro no contrato |

## 🧪 Exemplos de Uso

### Exemplo 1: Supply de AVAX
```javascript
const axios = require('axios');
const { ethers } = require('ethers');

// 1. Criar wallet
const wallet = new ethers.Wallet(PRIVATE_KEY);

// 2. Preparar dados
const amount = ethers.parseEther('1.0'); // 1 AVAX
const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
const signature = await wallet.signMessage(message);

// 3. Fazer requisição
const response = await axios.post('http://localhost:3001/benqi/supply', {
  address: wallet.address,
  signature: signature,
  message: message,
  timestamp: Date.now(),
  qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c', // qAVAX
  amount: amount.toString()
});

console.log('Transação preparada:', response.data);
```

### Exemplo 2: Validação + Supply
```javascript
const response = await axios.post('http://localhost:3001/benqi-validation/validateAndSupply', {
  privateKey: process.env.PRIVATE_KEY,
  qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  amount: ethers.parseEther('1.0').toString()
});

console.log('Transação executada:', response.data);
```

## 🔧 Configuração do Servidor

### Instalação
```bash
npm install
```

### Execução
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

### Variáveis de Ambiente
```bash
# .env
RPC_URL=https://api.avax.network/ext/bc/C/rpc
PRIVATE_KEY=0x...
PORT=3001
```

## 📈 Monitoramento

### Logs
- Todas as operações são logadas
- Logs incluem timestamp, endereço, operação e status
- Logs de erro incluem stack trace

### Métricas
- Rate limiting por IP
- Tempo de resposta das operações
- Taxa de sucesso/erro

## 🛡️ Segurança

### Boas Práticas
1. **Nunca exponha private keys** em logs ou respostas
2. **Use HTTPS** em produção
3. **Configure rate limiting** adequadamente
4. **Valide todas as entradas** do usuário
5. **Monitore** tentativas de acesso suspeitas

### Configuração de Produção
```javascript
// Rate limiting mais restritivo
const benqiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50 // 50 requests por 15 minutos
});

// Logs de segurança
app.use((req, res, next) => {
  console.log(`[SECURITY] ${req.ip} - ${req.method} ${req.path}`);
  next();
});
```

## 📞 Suporte

Para dúvidas ou problemas:
- **GitHub Issues**: [Link para repositório]
- **Email**: support@yourdomain.com
- **Documentação**: [Link para docs completas]

---

**Versão**: 1.0.0  
**Última atualização**: Setembro 2025  
**Rede**: Avalanche C-Chain (43114)
