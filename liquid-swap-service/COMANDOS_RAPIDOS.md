# ⚡ Comandos Rápidos - Liquid Swap Service

## 🚀 Início Rápido (3 passos)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env (adicione suas credenciais Thirdweb)
cp .env.example .env
nano .env  # ou use seu editor favorito

# 3. Rodar servidor
npm run dev
```

## ✅ Testar

### Opção 1: Testes Unitários (Mais Rápido)

```bash
npm test
```

**Resultado esperado:** `Tests: 20 passed, 20 total` ✅

### Opção 2: Script Interativo (Recomendado!)

```bash
./test-api-interactive.sh
```

**Menu interativo aparecerá:**
```
╔════════════════════════════════════════╗
║  Liquid Swap Service - Test Menu      ║
╚════════════════════════════════════════╝

1) Health Check
2) Same-Chain Swap (Uniswap)
3) Cross-Chain Swap (Thirdweb)
4) Swap na Base (L2)
5) Prepare Swap Transaction
6) Rodar TODOS os testes
0) Sair

Escolha uma opção:
```

### Opção 3: Comandos cURL Diretos

#### Health Check
```bash
curl http://localhost:3001/health | jq
```

#### Quote Same-Chain (Uniswap)
```bash
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

**Esperado:** `"uniswap"`

#### Quote Cross-Chain (Thirdweb)
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
  }' | jq '.quote.provider'
```

**Esperado:** `"thirdweb"`

## 🔍 Verificar Routing

### Ver qual provider está sendo usado

```bash
# Same-chain (deve usar Uniswap)
curl -s -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"fromChainId":1,"toChainId":1,"fromToken":"native","toToken":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","amount":"0.01","smartAccountAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"}' \
  | jq -r '.quote.provider'
```

### Monitorar logs em tempo real

```bash
# Rode o servidor em um terminal
npm run dev

# Em outro terminal, faça requests e veja os logs:
# - 🔄 Same-chain swap detected
# - ✅ Attempting Uniswap (preferred)
# - ✅ Auto-selected provider: uniswap
```

## 🎨 Frontend (MiniApp)

```bash
# Navegar para o MiniApp
cd /home/hugo/dev/projects/panoramablock/01/telegram/apps/miniapp

# Instalar
npm install

# Configurar
echo "VITE_SWAP_API_BASE=http://localhost:3001" > .env

# Rodar
npm run dev

# Abrir no navegador
# http://localhost:5173/swap
```

## 📊 Comandos de Desenvolvimento

### Rodar testes em watch mode
```bash
npm run test:watch
```

### Rodar com cobertura
```bash
npm run test:coverage
```

### Build para produção
```bash
npm run build
npm start
```

### Verificar tipos TypeScript
```bash
npx tsc --noEmit
```

## 🐛 Troubleshooting Rápido

### Servidor não inicia?
```bash
# Verificar porta 3001
lsof -i :3001

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Sempre usando Thirdweb?
```bash
# Verificar se Uniswap está habilitado
grep UNISWAP_ENABLED .env

# Ver erros do Uniswap
npm run dev 2>&1 | grep "UniswapAPI"
```

### Provider não aparece no frontend?
```bash
# Verificar resposta da API
curl -s http://localhost:3001/swap/quote [...] | jq '.quote.provider'

# Deve retornar: "uniswap" ou "thirdweb"
```

## 📚 Documentação Completa

- **Guia Completo**: [QUICK_START.md](./QUICK_START.md)
- **Sistema Multi-Provider**: [MULTI_PROVIDER_SYSTEM.md](./MULTI_PROVIDER_SYSTEM.md)
- **Deploy**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🎯 Casos de Uso Comuns

### 1. ETH → USDC (Ethereum)
```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"fromChainId":1,"toChainId":1,"fromToken":"native","toToken":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","amount":"0.1","smartAccountAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"}'
```
**Provider:** Uniswap ✅

### 2. USDC bridge Ethereum → Polygon
```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"fromChainId":1,"toChainId":137,"fromToken":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","toToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","amount":"100","smartAccountAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"}'
```
**Provider:** Thirdweb ✅

### 3. ETH → USDC (Base)
```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"fromChainId":8453,"toChainId":8453,"fromToken":"native","toToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"0.01","smartAccountAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"}'
```
**Provider:** Uniswap ✅

## 💡 Dicas

1. **Use jq** para formatar JSON: `curl ... | jq`
2. **Script interativo** é a forma mais fácil de testar
3. **Monitore os logs** para ver o routing em ação
4. **Teste both providers**: same-chain e cross-chain
5. **Frontend mostra** o provider com badge azul

## 🎉 Tudo Funcionando?

Você deve ver:

✅ Servidor rodando na porta 3001
✅ Testes passando (20/20)
✅ Same-chain usando Uniswap
✅ Cross-chain usando Thirdweb
✅ Provider aparecendo no frontend

**Próximo passo**: [DEPLOYMENT.md](./DEPLOYMENT.md) para produção! 🚀
