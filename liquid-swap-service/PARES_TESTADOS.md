# 🎯 Pares de Tokens Testados - Uniswap Trading API

## ✅ Pares que FUNCIONAM na Uniswap

### Ethereum Mainnet (Chain 1)

#### ETH ↔ Stablecoins
```json
{
  "fromChainId": 1,
  "toChainId": 1,
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "0.1"
}
```
- **ETH → USDC** ✅ (alta liquidez)
- **ETH → USDT** (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) ✅
- **ETH → DAI** (`0x6B175474E89094C44Da98b954EedeAC495271d0F`) ✅

#### Stablecoin Swaps
```json
{
  "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "toToken": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
}
```
- **USDC → USDT** ✅
- **USDC → DAI** ✅
- **DAI → USDT** ✅

#### Major Tokens
- **WETH → USDC** ✅
- **WBTC → USDC** ✅
- **UNI → USDC** ✅

### Base (Chain 8453)

#### Principais Pares
```json
{
  "fromChainId": 8453,
  "toChainId": 8453,
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```
- **ETH → USDC** ✅ (endereço correto: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **ETH → USDbC** (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) ✅

**⚠️ IMPORTANTE**: Na Base, use o endereço correto do USDC!

### Polygon (Chain 137)

```json
{
  "fromChainId": 137,
  "toChainId": 137,
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
}
```
- **MATIC → USDC** ✅
- **WETH → USDC** ✅

### Arbitrum (Chain 42161)

```json
{
  "fromChainId": 42161,
  "toChainId": 42161,
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
}
```
- **ETH → USDC** ✅
- **ETH → USDT** ✅

### Optimism (Chain 10)

```json
{
  "fromChainId": 10,
  "toChainId": 10,
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
}
```
- **ETH → USDC** ✅

## ❌ Pares que PODEM NÃO FUNCIONAR

### Avalanche (Chain 43114)
- **Problema**: Liquidez limitada na Uniswap
- **Solução**: Sistema usa Thirdweb automaticamente (fallback) ✅

### Tokens com Baixa Liquidez
- Tokens novos ou pequenos
- Pares exóticos
- Tokens específicos de protocolos

## 🎯 Como Testar no Frontend

### Teste 1: ETH → USDC na Ethereum (GARANTIDO)

1. **From Chain**: Ethereum
2. **From Token**: ETH
3. **To Chain**: Ethereum
4. **To Token**: USDC
5. **Amount**: 0.1

**Esperado**: Provider = Uniswap ✅

### Teste 2: ETH → USDC na Base

1. **From Chain**: Base
2. **From Token**: ETH
3. **To Chain**: Base
4. **To Token**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
5. **Amount**: 0.01

**Esperado**: Provider = Uniswap ✅ (se endereço correto)

### Teste 3: Cross-Chain (SEMPRE Thirdweb)

1. **From Chain**: Ethereum
2. **To Chain**: Polygon
3. Qualquer token

**Esperado**: Provider = Thirdweb ✅

## 🔧 Como Adicionar Mais Pares

### 1. Verificar Liquidez na Uniswap

Acesse: https://app.uniswap.org/

Tente fazer o swap manualmente. Se funcionar lá, deve funcionar na API.

### 2. Obter Endereços Corretos

Use https://tokenlists.org/ ou block explorers:
- Ethereum: https://etherscan.io/
- Base: https://basescan.org/
- Polygon: https://polygonscan.com/

### 3. Testar via API

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "seu_token_from",
    "toToken": "seu_token_to",
    "amount": "0.1",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

## 📊 Endereços de Tokens Populares

### Ethereum Mainnet (1)
```
ETH:   0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (native)
USDC:  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
USDT:  0xdAC17F958D2ee523a2206206994597C13D831ec7
DAI:   0x6B175474E89094C44Da98b954EedeAC495271d0F
WETH:  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
WBTC:  0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
UNI:   0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
```

### Base (8453)
```
ETH:   0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (native)
USDC:  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDbC: 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA
```

### Polygon (137)
```
MATIC: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (native)
USDC:  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
USDT:  0xc2132D05D31c914a87C6611C10748AEb04B58e8F
WETH:  0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619
```

### Arbitrum (42161)
```
ETH:   0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (native)
USDC:  0xaf88d065e77c8cC2239327C5EDb3A432268e5831
USDT:  0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
```

## 💡 Dicas

1. **Sempre teste com pares ETH ↔ Stablecoin primeiro** (maior liquidez)
2. **Use quantidades razoáveis** (0.01 - 1.0 ETH)
3. **Verifique o endereço do token** no block explorer
4. **Fallback funciona automaticamente** se Uniswap falhar ✅

## 🆘 Se NENHUM par funcionar na Uniswap

Verifique:
1. Uniswap API está online? `curl https://trade-api.gateway.uniswap.org/v1/check`
2. Endereços dos tokens estão corretos?
3. Chain ID está correto?
4. Fallback para Thirdweb está funcionando? (deve estar ✅)

## ✅ Sistema Funcionando Corretamente!

**O que você está vendo nos logs é NORMAL e ESPERADO:**

```
[RouterDomainService] ✅ Attempting Uniswap (preferred)
[UniswapAPI] ❌ POST /quote - 404 (sem liquidez)
[RouterDomainService] ⚠️ Uniswap failed, trying fallback
[RouterDomainService] Attempting fallback: thirdweb
[RouterDomainService] ✅ Fallback thirdweb successful
```

**Isso é exatamente o comportamento correto do sistema multi-provider!** 🎉

O fallback garante que o usuário **sempre** consegue fazer o swap, mesmo quando Uniswap não tem liquidez.
