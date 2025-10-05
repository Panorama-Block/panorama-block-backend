# 📚 Documentação Completa da API Panorama Block Backend

Esta documentação explica como usar todas as funcionalidades da API Panorama Block Backend.

## 🏗️ Arquitetura do Sistema

O sistema é composto por duas APIs principais:

- **`api_backend`** (Porta 3001): API principal com todas as funcionalidades
- **`api_frontend`** (Porta 3002): API simplificada para frontend, foca em preparação de transações

## 🚀 Início Rápido

### 1. Configuração do Ambiente

```bash
# Clone o repositório
git clone <repository-url>
cd panorama-block-backend

# Instalar dependências do backend
cd api_backend
npm install

# Instalar dependências do frontend
cd ../api_frontend
npm install
```

### 2. Configuração das Variáveis de Ambiente

Crie o arquivo `.env` em cada pasta:

#### `api_backend/.env`
```env
PRIVATE_KEY=sua_private_key_aqui
RPC_URL=https://api.avax.network/ext/bc/C/rpc
VALIDATION_CONTRACT_ADDRESS=endereco_do_contrato_deployado
PORT=3001
```

#### `api_frontend/.env`
```env
PRIVATE_KEY=sua_private_key_aqui
RPC_URL=https://api.avax.network/ext/bc/C/rpc
BACKEND_URL=http://localhost:3001
PORT=3002
```

### 3. Iniciar as APIs

```bash
# Terminal 1: Backend
cd api_backend
node index.js

# Terminal 2: Frontend
cd api_frontend
node index.js
```

## 📋 Endpoints Disponíveis

### 🔧 Backend API (`http://localhost:3001`)

#### **Trader Joe (DEX)**
- `GET /dex/getprice` - Obter preço de swap
- `GET /dex/getuserliquidity` - Obter liquidez do usuário
- `GET /dex/getpoolliquidity` - Obter liquidez do pool
- `GET /dex/gettokenliquidity` - Obter liquidez do token
- `POST /dex/swap` - Executar swap
- `POST /dex/addliquidity` - Adicionar liquidez
- `POST /dex/removeliquidity` - Remover liquidez
- `GET /dex/tokens` - Listar tokens

#### **Benqi (Lending)**
- `GET /benqi/qtokens` - Listar qTokens
- `GET /benqi/accountliquidity` - Obter liquidez da conta
- `POST /benqi/supply` - Preparar supply
- `POST /benqi/redeem` - Preparar redeem
- `POST /benqi/borrow` - Preparar borrow
- `POST /benqi/repay` - Preparar repay
- `POST /benqi/entermarkets` - Preparar enterMarkets
- `POST /benqi/exitmarket` - Preparar exitMarket

#### **Validation (Taxas)**
- `GET /validation/info` - Informações do contrato
- `POST /validation/calculate` - Calcular taxa
- `POST /validation/pay` - Executar pagamento
- `POST /validation/withdraw` - Retirar fundos (owner)

#### **Validação + Operações**
- `POST /benqi-validation/validateAndSupply` - Validação + supply
- `POST /benqi-validation/validateAndRedeem` - Validação + redeem
- `POST /benqi-validation/validateAndBorrow` - Validação + borrow
- `POST /benqi-validation/validateAndRepay` - Validação + repay
- `POST /validation-swap/validateAndSwap` - Validação + swap

### 🎨 Frontend API (`http://localhost:3002`)

#### **Lending (Simplificado)**
- `GET /lending/qtokens` - Listar qTokens (público)
- `POST /lending/enter-markets` - Preparar enterMarkets
- `POST /lending/exit-market` - Preparar exitMarket
- `POST /lending/validate-supply` - Preparar validação + supply
- `POST /lending/validate-redeem` - Preparar validação + redeem
- `POST /lending/validate-borrow` - Preparar validação + borrow
- `POST /lending/validate-repay` - Preparar validação + repay

#### **Swap (Simplificado)**
- `GET /swap/tokens` - Listar tokens (público)
- `GET /swap/price` - Obter preço (público)
- `GET /swap/quote` - Obter cotação (público)
- `POST /swap/validate-quote` - Obter cotação de validação + swap
- `POST /swap/validate-swap` - Preparar validação + swap

#### **Validation (Simplificado)**
- `GET /validation/status` - Status do sistema (público)
- `POST /validation/calculate` - Calcular taxa
- `POST /validation/pay` - Executar pagamento

## 🔐 Autenticação

### Smart Wallet (Recomendado para Frontend)

Para rotas que requerem autenticação, envie:

```json
{
  "address": "0x...",
  "signature": "0x...",
  "message": "Método Endpoint\nTimestamp: 1234567890",
  "timestamp": 1234567890,
  // ... outros parâmetros da rota
}
```

### Private Key (Backend apenas)

Para execução direta no backend:

```json
{
  "privateKey": "0x...",
  // ... outros parâmetros da rota
}
```

## 💡 Exemplos de Uso

### 1. Listar Tokens Disponíveis (Público)

```bash
curl http://localhost:3002/swap/tokens
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "message": "Tokens listados com sucesso",
    "tokens": [
      {
        "symbol": "AVAX",
        "address": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        "name": "Avalanche",
        "decimals": 18,
        "logo": "https://..."
      }
    ],
    "total": 6
  }
}
```

### 2. Preparar Transação de Validação + Supply

```bash
curl -X POST http://localhost:3002/lending/validate-supply \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x...",
    "signature": "0x...",
    "message": "POST /lending/validate-supply\nTimestamp: 1234567890",
    "timestamp": 1234567890,
    "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
    "amount": "1000000000000000000"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "message": "Transação de validação + supply preparada com sucesso",
    "operation": "prepareValidationAndSupply",
    "transaction": {
      "to": "0x...",
      "data": "0x...",
      "value": "0x...",
      "gasLimit": "0x...",
      "gasPrice": "0x..."
    },
    "qTokenAddress": "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
    "amount": "1000000000000000000",
    "network": "Avalanche C-Chain"
  }
}
```

### 3. Obter Cotação de Validação + Swap

```bash
curl -X POST http://localhost:3002/swap/validate-quote \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x...",
    "signature": "0x...",
    "message": "POST /swap/validate-quote\nTimestamp: 1234567890",
    "timestamp": 1234567890,
    "tokenIn": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "tokenOut": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "amountIn": "1000000000000000000"
  }'
```

## 🧪 Testes

### Executar Todos os Testes

```bash
./run-all-tests.sh
```

### Executar Testes Específicos

```bash
# Backend
cd api_backend/tests
./run-tests.sh

# Frontend
cd api_frontend/tests
./run-tests.sh
```

### Executar Testes Individuais

```bash
# Backend
cd api_backend
node tests/test.js

# Frontend
cd api_frontend
node tests/test-frontend.js
```

## 🔧 Configuração Avançada

### Rate Limiting

- **Lending**: 100 requests por 15 minutos
- **Swap**: 100 requests por 15 minutos
- **Validation**: 50 requests por 15 minutos

### Middleware

- **`verifySignature`**: Verifica assinatura do wallet
- **`checkBackendHealth`**: Verifica saúde do backend
- **`sanitizeInput`**: Limpa dados de entrada
- **`validateNetwork`**: Valida rede blockchain

### Tratamento de Erros

Todas as respostas seguem o padrão:

```json
{
  "success": true|false,
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição do erro",
    "details": { ... }
  }
}
```

## 🚨 Troubleshooting

### Backend não inicia
- Verifique se a porta 3001 está livre
- Verifique se o RPC_URL está acessível
- Verifique se a PRIVATE_KEY está configurada

### Frontend não inicia
- Verifique se a porta 3002 está livre
- Verifique se o backend está rodando
- Verifique se o BACKEND_URL está correto

### Erro de autenticação
- Verifique se a assinatura está correta
- Verifique se o endereço corresponde à assinatura
- Verifique se a mensagem está no formato correto

### Erro de contrato
- Verifique se o VALIDATION_CONTRACT_ADDRESS está correto
- Verifique se o contrato está deployado
- Verifique se a rede está correta

## 📊 Monitoramento

### Health Checks

```bash
# Backend
curl http://localhost:3001/health

# Frontend
curl http://localhost:3002/health
```

### Logs

Os logs são exibidos no console com formato:
- `✅` - Sucesso
- `❌` - Erro
- `⚠️` - Aviso
- `🔍` - Informação

## 🔗 Integração com Frontend

### 1. Configurar Wallet

```javascript
// Exemplo com MetaMask
const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
const address = accounts[0];
```

### 2. Criar Assinatura

```javascript
const message = `POST /lending/validate-supply\nTimestamp: ${Date.now()}`;
const signature = await ethereum.request({
  method: 'personal_sign',
  params: [message, address]
});
```

### 3. Fazer Requisição

```javascript
const response = await fetch('http://localhost:3002/lending/validate-supply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address,
    signature,
    message,
    timestamp: Date.now(),
    qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    amount: '1000000000000000000'
  })
});
```

### 4. Executar Transação

```javascript
const { transaction } = await response.json();
const tx = await ethereum.request({
  method: 'eth_sendTransaction',
  params: [transaction]
});
```

## 📝 Notas Importantes

1. **Segurança**: Nunca exponha a PRIVATE_KEY no frontend
2. **Rate Limiting**: Respeite os limites de requisições
3. **Validação**: Sempre valide dados antes de enviar
4. **Testes**: Execute testes antes de deploy em produção
5. **Logs**: Monitore logs para identificar problemas

## 🆘 Suporte

Para dúvidas ou problemas:

1. Verifique os logs da API
2. Execute os testes para verificar funcionamento
3. Consulte a documentação de cada endpoint
4. Verifique a configuração das variáveis de ambiente
