# Análise de APIs Uniswap - Solução para Problema de Quotes

## 🔴 Problema Atual

A aplicação está usando **Uniswap Trading API v1** que retorna frequentemente erro 404 "No quotes available" para pares de tokens populares:

```
[UniswapAPI] ❌ POST /quote - 404
[UniswapAPI] Error details: {
  status: 404,
  errorCode: 'ResourceNotFound',
  detail: 'No quotes available'
}
```

**Pares testados com falha:**
- Base (8453): ETH → USDC
- Avalanche (43114): AVAX → JOE
- Avalanche (43114): AVAX → USDC

## 🔍 APIs Uniswap Disponíveis

### 1. **Uniswap Trading API v1** (ATUAL - PROBLEMÁTICA)

**URL**: `https://trade-api.gateway.uniswap.org/v1`

**Status**: ❌ **NÃO RECOMENDADA** - Alta taxa de falha

**Problemas identificados:**
- Retorna 404 para muitos pares de tokens
- Baixa disponibilidade de liquidez
- Sem documentação clara de chains/pares suportados
- Não é confiável como fonte primária

**Chains suportadas**: 15 chains (Ethereum, Base, Polygon, etc.)

**Implementação atual**: `src/infrastructure/adapters/uniswap.swap.adapter.ts`

---

### 2. **Uniswap Smart Order Router** (RECOMENDADA ✅)

**Package**: `@uniswap/smart-order-router`

**Versão**: 4.22.16 (atualizado recentemente)

**Status**: ✅ **RECOMENDADA COMO SOLUÇÃO**

**Vantagens:**
- ✅ **Busca direta na blockchain** - Não depende de API HTTP externa
- ✅ **Auto Router V2** - Otimiza rotas entre Uniswap V2 e V3
- ✅ **Split routes** - Divide trades em múltiplas rotas para melhor preço
- ✅ **Gas optimization** - Considera custo de gas nas rotas
- ✅ **Maior cobertura** - Acessa toda liquidez on-chain
- ✅ **Sem rate limits** - Conecta direto via RPC
- ✅ **Open source** - Mantido oficialmente pela Uniswap Labs

**Chains suportadas:**
- Ethereum (1)
- Optimism (10)
- Arbitrum (42161)
- Polygon (137)
- Base (8453)
- BNB Chain (56)
- Avalanche (43114)
- Celo (42220)
- Blast (81457)
- Zora (7777777)

**Exemplo de uso:**

```typescript
import { AlphaRouter } from '@uniswap/smart-order-router'
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core'
import { ethers } from 'ethers'

// Inicializar (IMPORTANTE: configurar network explicitamente)
const network = { name: 'mainnet', chainId: 1 };
const provider = new ethers.providers.JsonRpcProvider(RPC_URL, network)
const router = new AlphaRouter({
  chainId: 1,
  provider
})

// Definir tokens
const WETH = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH')
const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')

// Get quote
const amount = CurrencyAmount.fromRawAmount(WETH, '1000000000000000000') // 1 ETH

const route = await router.route(
  amount,
  USDC,
  TradeType.EXACT_IN,
  {
    recipient: walletAddress,
    slippageTolerance: new Percent(50, 10_000), // 0.5%
    deadline: Math.floor(Date.now() / 1000 + 1800) // 30 min
  }
)

if (route) {
  console.log(`Quote: ${route.quote.toFixed()} USDC`)
  console.log(`Gas estimate: ${route.estimatedGasUsed.toString()}`)
  console.log(`Gas price: ${route.gasPriceWei.toString()}`)
}
```

**Formato de resposta:**

```typescript
{
  quote: CurrencyAmount // Quantidade estimada de saída
  quoteGasAdjusted: CurrencyAmount // Ajustado por gas
  estimatedGasUsed: BigNumber
  estimatedGasUsedQuoteToken: CurrencyAmount
  gasPriceWei: BigNumber
  route: Route[] // Rotas detalhadas
  blockNumber: BigNumber
  methodParameters?: MethodParameters // Calldata para executar
}
```

---

### 3. **Uniswap Universal Router SDK**

**Package**: `@uniswap/universal-router-sdk`

**Status**: 🟡 **ALTERNATIVA** (mais complexa)

**Uso recomendado:**
- Quando precisa combinar swaps ERC20 + NFT
- Integração com Permit2
- Transações compostas complexas

**Não recomendada para nosso caso** porque:
- Mais complexa que necessário
- Foco em transações compostas (NFT + swaps)
- Smart Order Router é mais direto para swaps simples

---

### 4. **DEX Aggregators** (Alternativa externa)

**Opções:**
- **1inch API** - Agrega múltiplas DEXs
- **0x API (Matcha)** - Agrega liquidez cross-DEX
- **ParaSwap (Velora)** - Multi-chain aggregator

**Status**: 🟡 **CONSIDERAR** se quiser agregar além de Uniswap

**Vantagens:**
- Podem encontrar preços melhores que Uniswap sozinho
- Agregam múltiplas fontes de liquidez

**Desvantagens:**
- Adiciona dependência externa
- Não é "Uniswap puro" (usuário pediu Uniswap especificamente)
- Mais complexidade de integração

---

## ✅ Solução Recomendada

### **Migrar para Uniswap Smart Order Router**

**Razões:**

1. ✅ **Confiabilidade** - Busca direto na blockchain, não depende de API HTTP
2. ✅ **Cobertura** - Acessa toda liquidez disponível em Uniswap V2 e V3
3. ✅ **Performance** - Auto Router V2 otimiza rotas automaticamente
4. ✅ **Oficial** - Mantido pela Uniswap Labs
5. ✅ **Sem rate limits** - Conecta via RPC provider
6. ✅ **Resolve o problema** - Elimina erros 404 "No quotes available"

**Arquitetura proposta:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  - ProviderSelectorService                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  - RouterDomainService (routing logic)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│                                                              │
│  Same-Chain Priority:                                       │
│  1. UniswapSmartRouterAdapter (NEW - RECOMMENDED) ✅        │
│  2. UniswapTradingApiAdapter (OLD - FALLBACK) 🟡           │
│  3. ThirdwebProviderAdapter (LAST RESORT) 🔴                │
│                                                              │
│  Cross-Chain:                                               │
│  1. ThirdwebProviderAdapter (ONLY OPTION)                  │
└─────────────────────────────────────────────────────────────┘
```

**Lógica de fallback:**

```typescript
async selectForSameChain(request: SwapRequest) {
  const providers = [
    'uniswap-smart-router',  // Prioridade 1 - NOVO
    'uniswap-trading-api',    // Prioridade 2 - Mantém como backup
    'thirdweb'                // Prioridade 3 - Último recurso
  ];

  for (const providerName of providers) {
    try {
      const provider = this.providers.get(providerName);
      const quote = await provider.getQuote(request);
      return { provider, quote };
    } catch (error) {
      console.log(`[Router] ${providerName} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All same-chain providers failed');
}
```

---

## 🛠️ Implementação

### Passo 1: Instalar dependências

```bash
cd panorama-block-backend/liquid-swap-service
npm install @uniswap/smart-order-router @uniswap/sdk-core ethers@5
```

**Nota**: Smart Order Router usa ethers v5, não v6

### Passo 2: Criar novo adapter

Criar: `src/infrastructure/adapters/uniswap.smartrouter.adapter.ts`

```typescript
import { AlphaRouter } from '@uniswap/smart-order-router';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { ISwapProvider } from '../../domain/ports/swap.provider.port';
import { SwapQuote, SwapRequest } from '../../domain/entities/swap.entity';

export class UniswapSmartRouterAdapter implements ISwapProvider {
  name = 'uniswap-smart-router';
  private routers: Map<number, AlphaRouter> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();

  // Chains suportadas
  private supportedChains = [1, 10, 137, 8453, 42161, 43114, 56, 42220, 81457, 7777777];

  constructor() {
    this.initializeRouters();
  }

  private initializeRouters() {
    // Inicializar routers para cada chain
    for (const chainId of this.supportedChains) {
      const rpcUrl = this.getRpcUrl(chainId);

      // IMPORTANTE: Configurar network explicitamente para evitar "could not detect network"
      const network = { name: `chain-${chainId}`, chainId };
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, network);
      const router = new AlphaRouter({ chainId, provider });

      this.providers.set(chainId, provider);
      this.routers.set(chainId, router);
    }
  }

  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    // Implementação completa no próximo passo
  }

  async prepareSwap(request: SwapRequest): Promise<any> {
    // Implementação completa no próximo passo
  }

  private getRpcUrl(chainId: number): string {
    // Mapear chain IDs para RPC URLs
    const rpcMap: Record<number, string> = {
      1: process.env.RPC_URL_1 || 'https://eth.llamarpc.com',
      137: process.env.RPC_URL_137 || 'https://polygon.llamarpc.com',
      8453: process.env.RPC_URL_8453 || 'https://base.llamarpc.com',
      // ... adicionar outras chains
    };
    return rpcMap[chainId] || '';
  }
}
```

### Passo 3: Registrar no DIContainer

```typescript
// Em src/infrastructure/di/container.ts

import { UniswapSmartRouterAdapter } from '../adapters/uniswap.smartrouter.adapter';

constructor() {
  // ...
  this._uniswapSmartRouter = new UniswapSmartRouterAdapter();
  this._uniswapTradingApi = new UniswapSwapAdapter(); // Renomear o atual

  const providerMap = new Map<string, ISwapProvider>();
  providerMap.set('uniswap-smart-router', this._uniswapSmartRouter); // Prioridade 1
  providerMap.set('uniswap-trading-api', this._uniswapTradingApi);   // Prioridade 2
  providerMap.set('thirdweb', this._thirdwebProvider);                // Prioridade 3

  this._routerDomainService = new RouterDomainService(providerMap);
  // ...
}
```

### Passo 4: Atualizar RouterDomainService

```typescript
// Em src/domain/services/router.domain.service.ts

async selectForSameChain(request: SwapRequest): Promise<{ provider: ISwapProvider; quote: SwapQuote }> {
  console.log('[RouterDomainService] 🔄 Same-chain swap detected');

  // Nova ordem de prioridade
  const preferredProviders = [
    'uniswap-smart-router',  // ✅ NOVO - Prioridade máxima
    'uniswap-trading-api',    // 🟡 Mantém como backup
    'thirdweb'                // 🔴 Último recurso
  ];

  const errors: string[] = [];

  for (const providerName of preferredProviders) {
    const provider = this.providers.get(providerName);
    if (!provider) continue;

    try {
      console.log(`[RouterDomainService] ✅ Tentando ${providerName}...`);
      const quote = await provider.getQuote(request);
      console.log(`[RouterDomainService] ✅ ${providerName} retornou quote com sucesso`);
      return { provider, quote };
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.log(`[RouterDomainService] ⚠️ ${providerName} falhou: ${errorMsg}`);
      errors.push(`${providerName}: ${errorMsg}`);
      continue; // Tenta próximo provider
    }
  }

  throw new Error(`Todos os providers falharam: ${errors.join(', ')}`);
}
```

---

## 📊 Comparação de APIs

| Feature | Trading API v1 (atual) | Smart Order Router (recomendado) | Universal Router | DEX Aggregators |
|---------|----------------------|--------------------------------|------------------|-----------------|
| **Confiabilidade** | ❌ Baixa (404s frequentes) | ✅ Alta (on-chain) | ✅ Alta | 🟡 Depende do serviço |
| **Cobertura de pares** | ❌ Limitada | ✅ Completa (V2+V3) | ✅ Completa | ✅ Multi-DEX |
| **Rate Limits** | ✅ Sem info clara | ✅ Nenhum (RPC) | ✅ Nenhum (RPC) | ❌ Sim |
| **Chains suportadas** | 15 | 10+ | 10+ | Varia |
| **Gas optimization** | ❌ Básico | ✅ Avançado (Auto Router V2) | ✅ Avançado | ✅ Sim |
| **Complexidade** | 🟢 Simples | 🟡 Moderada | 🔴 Alta | 🟡 Moderada |
| **Manutenção** | ❌ API externa | ✅ Oficial Uniswap | ✅ Oficial Uniswap | 🟡 Third-party |
| **Documentação** | ❌ Limitada | ✅ Excelente | ✅ Boa | 🟡 Varia |
| **Custo** | ✅ Grátis | ✅ Grátis (paga RPC) | ✅ Grátis (paga RPC) | 🟡 Alguns pagos |

**Vencedor**: ✅ **Uniswap Smart Order Router**

---

## 🎯 Benefícios da Solução

### Para o Usuário:
✅ **Quotes sempre disponíveis** - Elimina erro 404
✅ **Melhores preços** - Auto Router V2 otimiza rotas
✅ **Transparência** - Frontend continua mostrando "Uniswap"
✅ **Confiabilidade** - Busca direto na blockchain

### Para o Sistema:
✅ **Sem rate limits** - Conecta via RPC
✅ **Fallback robusto** - 3 níveis de providers
✅ **Mantém arquitetura** - Só adiciona novo adapter
✅ **Open source** - Código auditável

### Para Desenvolvimento:
✅ **Bem documentado** - Exemplos claros
✅ **Mantido oficialmente** - Uniswap Labs
✅ **Comunidade ativa** - NPM com 179 projetos usando
✅ **TypeScript nativo** - Type safety completa

---

## 🚀 Próximos Passos

1. ✅ **Documentação completa** - Este documento
2. ⏭️ **Implementar UniswapSmartRouterAdapter** - Novo adapter completo
3. ⏭️ **Atualizar DIContainer** - Registrar novo provider
4. ⏭️ **Atualizar RouterDomainService** - Nova ordem de prioridade
5. ⏭️ **Testes unitários** - Testar novo adapter
6. ⏭️ **Testes de integração** - Testar com pares reais
7. ⏭️ **Testar no frontend** - Validar com Metamask
8. ⏭️ **Deploy** - Produção com monitoramento

---

## 📝 Notas Adicionais

### RPC Providers Recomendados

Para melhor performance com Smart Order Router:

```bash
# .env
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY  # Ethereum
RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY  # Polygon
RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY  # Base
RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY  # Arbitrum
RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY  # Optimism
```

**Providers gratuitos (fallback):**
- LlamaRPC: `https://{chain}.llamarpc.com`
- Ankr: `https://rpc.ankr.com/{chain}`
- Public RPCs: Veja chainlist.org

### Custos

**Smart Order Router:**
- ✅ NPM package: Grátis
- ✅ Uso: Grátis
- 💰 RPC calls: Grátis até certo limite (Alchemy: 300M/mês grátis)

**Comparado com Trading API v1:**
- Mesmos custos (também usa RPC por trás)
- Mas com muito mais confiabilidade

---

## ✅ Conclusão

A migração para **Uniswap Smart Order Router** resolve completamente o problema de quotes falhando com 404. É a solução oficial, robusta e recomendada pela Uniswap Labs para integração em aplicações.

**Recomendação final**: ✅ **Implementar Smart Order Router como provider primário para same-chain swaps**
