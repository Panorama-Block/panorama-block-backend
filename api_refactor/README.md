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

3. Edite o `.env` com sua private key:
```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

## 🧪 Teste Básico

Execute o teste de swap:
```bash
node test.js
```

Este teste faz:
- ✅ Verifica saldos (AVAX, WAVAX, USDT)
- ✅ Obtém preço atual WAVAX → USDT
- ✅ Aprova Trader Joe se necessário
- ✅ Executa swap de 0.001 WAVAX → USDT
- ✅ Mostra resultados e saldos finais

## 🚀 Iniciar API

```bash
npm start
```

A API estará disponível em `http://localhost:3001`

## 📚 Endpoints Disponíveis

### GET `/health`
Verifica se a API está funcionando.

### GET `/info`
Informações sobre a API.

### GET `/network-status`
Status da rede Avalanche.

### GET `/config`
Configurações atuais.

### GET `/getprice?dexId=traderjoe&path=WAVAX,USDT&amountIn=1000000000000000`
Obtém preço de swap.

### POST `/swap`
Executa swap de tokens.

**Body:**
```json
{
  "privateKey": "0x1234...",
  "tokenPath": ["WAVAX", "USDT"],
  "amountIn": "1000000000000000",
  "slippage": 90
}
```

### POST `/addliquidity`
Adiciona liquidez a um pool.

### POST `/removeliquidity`
Remove liquidez de um pool.

### GET `/getuserliquidity`
Obtém liquidez do usuário.

### GET `/getpoolliquidity`
Obtém liquidez do pool.

### GET `/gettokenliquidity`
Obtém liquidez de um token.

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
