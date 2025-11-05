![![alt text](image-1.png)](image.png)# 🚀 Guia Rápido - Como Rodar e Testar

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Credenciais Thirdweb (CLIENT_ID e SECRET_KEY)

## 🏃 Rodando a Aplicação

### 1. Instalar Dependências

```bash
cd /home/hugo/dev/projects/panoramablock/01/panorama-block-backend/liquid-swap-service

npm install
```

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```bash
# Crie o arquivo .env
touch .env
```

Adicione as seguintes variáveis:

```env
# Thirdweb (OBRIGATÓRIO)
THIRDWEB_CLIENT_ID=seu_client_id_aqui
THIRDWEB_SECRET_KEY=seu_secret_key_aqui

# Uniswap (opcional - habilitado por padrão)
UNISWAP_ENABLED=true

# Server
PORT=3001
NODE_ENV=development

# Debug
DEBUG=true
```

### 3. Rodar em Modo Desenvolvimento

```bash
npm run dev
```

Você verá algo como:

```
[DIContainer] Initializing dependency injection container
[UniswapSwapAdapter] Initialized (enabled: true, baseURL: https://trade-api.gateway.uniswap.org/v1)
[ThirdwebSwapAdapter] Initialized successfully (non-custodial mode)
[RouterDomainService] Initialized with 2 providers: [ 'uniswap', 'thirdweb' ]
[ProviderSelectorService] Initialized
[DIContainer] Dependency injection container initialized successfully

Server running on port 3001
```

## ✅ Testando a Aplicação

### Opção 1: Testes Unitários (Recomendado para começar)

```bash
# Rodar todos os testes
npm test

# Rodar em modo watch (atualiza automaticamente)
npm run test:watch

# Rodar com cobertura
npm run test:coverage
```

**Resultado esperado:**
```
Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        8.046 s
```

### Opção 2: Teste de Integração

```bash
npx ts-node test-integration.ts
```

Este teste verifica:
- ✅ Same-chain swap (Uniswap)
- ✅ Cross-chain swap (Thirdweb)
- ✅ Mecanismo de fallback

### Opção 3: Testar API com cURL

#### 3.1. Health Check

```bash
curl http://localhost:3001/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T10:30:00.000Z"
}
```

#### 3.2. Get Quote (Same-Chain - Usará Uniswap)

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "0.01",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "quote": {
    "fromChainId": 1,
    "toChainId": 1,
    "amount": "10000000000000000",
    "estimatedReceiveAmount": "39900454",
    "exchangeRate": 3990.0454,
    "provider": "uniswap",  ← Veja aqui qual provider foi usado!
    "fees": {
      "bridgeFee": "0",
      "gasFee": "50000000000000",
      "totalFee": "50000000000000"
    }
  }
}
```

#### 3.3. Get Quote (Cross-Chain - Usará Thirdweb)

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 137,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "10",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "quote": {
    "fromChainId": 1,
    "toChainId": 137,
    "amount": "10000000",
    "estimatedReceiveAmount": "9964758",
    "provider": "thirdweb",  ← Cross-chain usa Thirdweb!
    ...
  }
}
```

#### 3.4. Prepare Swap

```bash
curl -X POST http://localhost:3001/swap/tx \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "10000000000000000",
    "sender": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "prepared": {
    "transactions": [
      {
        "to": "0x...",
        "data": "0x...",
        "value": "10000000000000000",
        "chainId": 1
      }
    ]
  },
  "provider": "uniswap"  ← Qual provider preparou a transação
}
```

### Opção 4: Testar com Postman/Insomnia

Importe esta coleção de requests:

**Collection JSON:**
```json
{
  "name": "Liquid Swap Service",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:3001/health"
    },
    {
      "name": "Quote - Same Chain (Uniswap)",
      "method": "POST",
      "url": "http://localhost:3001/swap/quote",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "fromChainId": 1,
        "toChainId": 1,
        "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amount": "0.01",
        "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
      }
    },
    {
      "name": "Quote - Cross Chain (Thirdweb)",
      "method": "POST",
      "url": "http://localhost:3001/swap/quote",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "fromChainId": 1,
        "toChainId": 137,
        "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        "amount": "10",
        "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
      }
    }
  ]
}
```

## 🔍 Testando o Sistema Multi-Provider

### Cenário 1: Verificar Routing Automático

**Same-Chain Swap (deve usar Uniswap):**

```bash
# ETH → USDC na Ethereum
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "native",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "0.01",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }' | jq '.quote.provider'
```

**Resultado esperado:** `"uniswap"`

**Cross-Chain Swap (deve usar Thirdweb):**

```bash
# USDC Ethereum → USDC Polygon
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 137,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "10",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }' | jq '.quote.provider'
```

**Resultado esperado:** `"thirdweb"`

### Cenário 2: Testar Fallback (Desabilitar Uniswap)

```bash
# Desabilite Uniswap temporariamente
echo "UNISWAP_ENABLED=false" >> .env

# Reinicie o servidor
npm run dev

# Teste same-chain swap (agora deve usar Thirdweb como fallback)
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "native",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "0.01",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }' | jq '.quote.provider'
```

**Resultado esperado:** `"thirdweb"` (fallback funcionou!)

### Cenário 3: Verificar Logs de Routing

Acompanhe os logs do servidor enquanto faz requests:

```bash
# Em um terminal, rode o servidor com logs
npm run dev

# Em outro terminal, faça requests
# Você verá logs como:

[RouterDomainService] Selecting provider for: Swap(1 -> 1, ...)
[RouterDomainService] 🔄 Same-chain swap detected
[RouterDomainService] ✅ Attempting Uniswap (preferred)
[RouterDomainService] ✅ Uniswap quote successful
[ProviderSelectorService] ✅ Auto-selected provider: uniswap
```

## 🎨 Testando Frontend (MiniApp)

### 1. Rodar o MiniApp

```bash
cd /home/hugo/dev/projects/panoramablock/01/telegram/apps/miniapp

# Instalar dependências
npm install

# Configurar .env
echo "VITE_SWAP_API_BASE=http://localhost:3001" > .env
echo "VITE_THIRDWEB_CLIENT_ID=seu_client_id_aqui" >> .env

# Rodar em desenvolvimento
npm run dev
```

### 2. Acessar a Interface

Abra no navegador: `http://localhost:5173/swap` (ou a porta que o Vite mostrar)

### 3. Testar Swap UI

1. **Selecione tokens**:
   - From: ETH (Ethereum)
   - To: USDC (Ethereum)

2. **Digite quantidade**: 0.01 ETH

3. **Veja o Quote Details** aparecer:
   ```
   ┌─────────────────────────────────────┐
   │ 📊 Quote Details                    │
   ├─────────────────────────────────────┤
   │ Provider:              Uniswap ←    │  ← Badge azul!
   │ From Amount:           0.01 ETH     │
   │ To Amount:             39.90 USDC   │
   └─────────────────────────────────────┘
   ```

4. **Teste Cross-Chain**:
   - From: USDC (Ethereum)
   - To: USDC (Polygon)
   - Veja provider mudar para **Thirdweb**

## 📊 Monitorando a Aplicação

### Ver logs em tempo real

```bash
# Durante desenvolvimento
npm run dev

# Em produção, use PM2 ou Docker logs
pm2 logs liquid-swap-service

# Com Docker
docker logs -f liquid-swap-service
```

### Métricas importantes nos logs

Procure por estas mensagens:

```
✅ Auto-selected provider: uniswap    → Uniswap selecionado
✅ Auto-selected provider: thirdweb   → Thirdweb selecionado
⚠️ Uniswap failed, trying fallback    → Fallback ativado
❌ All providers failed                → Erro crítico
```

### Verificar distribuição de providers

```bash
# Contar quantas vezes cada provider foi usado
grep "Auto-selected provider" logs.txt | sort | uniq -c

# Exemplo de saída:
#  45 Auto-selected provider: uniswap
#  23 Auto-selected provider: thirdweb
```

## 🐛 Troubleshooting

### Problema: Servidor não inicia

**Solução:**
```bash
# Verifique as variáveis de ambiente
cat .env | grep THIRDWEB

# Verifique se a porta está disponível
lsof -i :3001

# Instale dependências novamente
rm -rf node_modules
npm install
```

### Problema: Todos os swaps usando Thirdweb (Uniswap não funciona)

**Solução:**
```bash
# Verifique se Uniswap está habilitado
grep "UNISWAP_ENABLED" .env

# Veja os logs de erro do Uniswap
npm run dev | grep "UniswapAPI"

# Teste a API do Uniswap diretamente
curl https://trade-api.gateway.uniswap.org/v1/check
```

### Problema: Provider não aparece no frontend

**Solução:**

1. Verifique a resposta da API no browser DevTools (Network tab)
2. Procure pelo campo `"provider"` na resposta JSON
3. Verifique se `SwapCard.tsx` tem o código de exibição do provider
4. Limpe o cache do navegador e recarregue

## 📝 Exemplos de Casos de Uso

### Caso 1: Swap ETH por USDC na Ethereum

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "native",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "0.1",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Provider esperado:** `uniswap` (same-chain)

### Caso 2: Bridge USDC de Ethereum para Polygon

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 137,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "100",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Provider esperado:** `thirdweb` (cross-chain)

### Caso 3: Swap na Base (L2)

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 8453,
    "toChainId": 8453,
    "fromToken": "native",
    "toToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "0.01",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

**Provider esperado:** `uniswap` (Base é suportado)

## 🎯 Próximos Passos

Depois de testar localmente:

1. ✅ Rode os testes: `npm test`
2. ✅ Teste a API com diferentes pares de tokens
3. ✅ Verifique os logs de routing
4. ✅ Teste o frontend no browser
5. ✅ Leia a documentação completa: [MULTI_PROVIDER_SYSTEM.md](./MULTI_PROVIDER_SYSTEM.md)
6. ✅ Prepare para deploy: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📚 Recursos Úteis

- **Documentação Completa**: [MULTI_PROVIDER_SYSTEM.md](./MULTI_PROVIDER_SYSTEM.md)
- **Guia de Deploy**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Resumo de Implementação**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Testes**: `npm test` ou `npx ts-node test-integration.ts`

## 💡 Dicas

1. **Use jq para formatar JSON**: `curl ... | jq`
2. **Monitore logs em tempo real**: `npm run dev`
3. **Teste ambos os providers**: same-chain e cross-chain
4. **Verifique o campo `provider`** em todas as respostas
5. **Use o frontend** para visualizar o provider badge

---

**Precisa de ajuda?** Verifique a seção de Troubleshooting ou os logs do servidor para mais detalhes.
