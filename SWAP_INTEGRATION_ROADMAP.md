# 🚀 UNISWAP SWAP INTEGRATION - ROADMAP COMPLETO

## 📋 VISÃO GERAL

**Objetivo:** Implementar swap híbrido com roteamento inteligente entre Uniswap Trading API (same-chain) e Thirdweb (cross-chain), seguindo arquitetura hexagonal existente.

**Estratégia:**
- ✅ **Same-chain swaps** → Uniswap Trading API (melhor liquidez, routing V2/V3/V4/UniswapX)
- ✅ **Cross-chain swaps** → Thirdweb Bridge (especializado)
- ✅ **Fallback automático** entre providers

**Priorização:** Thirdweb para features externas não-Uniswap (gas estimation, price feeds, RPC, etc.)

---

## 🎯 FASES DE IMPLEMENTAÇÃO

### **FASE 1: BACKEND - DOMAIN & PORTS** (5-7 dias)
Criar interfaces genéricas e domain services para multi-provider support

### **FASE 2: BACKEND - UNISWAP ADAPTER** (7-10 dias)
Implementar Uniswap Trading API adapter completo

### **FASE 3: BACKEND - ROUTER & INTEGRATION** (5-7 dias)
Integrar routing inteligente no sistema existente

### **FASE 4: TESTES BACKEND** (3-5 dias)
Testes unitários e de integração

### **FASE 5: FRONTEND/MINIAPP INTEGRATION** (5-7 dias)
Atualizar frontend para suportar multi-provider

### **FASE 6: E2E TESTING** (3-4 dias)
Testes end-to-end em testnet e mainnet

---

## 📊 FASE 1: BACKEND - DOMAIN & PORTS

### **Objetivo:** Criar abstração para suportar múltiplos swap providers

### **Tasks Detalhadas:**

#### **TASK 1.1: Criar ISwapProvider Port**
**Arquivo:** `src/domain/ports/swap.provider.port.ts`

**Sub-tasks:**
- [ ] 1.1.1: Criar interface `ISwapProvider` com métodos:
  - `readonly name: string` - Identificador do provider
  - `supportsRoute(params: RouteParams): Promise<boolean>` - Checagem de suporte
  - `getQuote(request: SwapRequest): Promise<SwapQuote>` - Obter cotação
  - `prepareSwap(request: SwapRequest): Promise<PreparedSwap>` - Preparar transações
  - `monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus>` - Monitorar TX

- [ ] 1.1.2: Criar interface `RouteParams`:
  ```typescript
  {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
  }
  ```

- [ ] 1.1.3: Criar interface `PreparedSwap`:
  ```typescript
  {
    provider: string;
    transactions: Transaction[];
    estimatedDuration: number;
    expiresAt?: Date;
    metadata?: Record<string, any>; // Provider-specific data
  }
  ```

- [ ] 1.1.4: Criar interface `Transaction`:
  ```typescript
  {
    chainId: number;
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  }
  ```

- [ ] 1.1.5: Adicionar JSDoc comentários explicando cada método e quando usar
- [ ] 1.1.6: Criar tipos auxiliares (RouteParams, PreparedSwap, Transaction)

**Arquivos de referência:**
- Estudar: `src/domain/ports/swap.repository.ts` (padrão de ports existente)
- Estudar: `src/domain/entities/swap.ts` (entidades que usaremos)

**Validação:**
- ✅ Interface compilando sem erros
- ✅ JSDoc completo em todos os métodos
- ✅ Tipos auxiliares exportados corretamente

---

#### **TASK 1.2: Criar RouterDomainService**
**Arquivo:** `src/domain/services/router.domain.service.ts`

**Sub-tasks:**
- [ ] 1.2.1: Criar classe `RouterDomainService` com constructor:
  ```typescript
  constructor(private readonly providers: Map<string, ISwapProvider>)
  ```

- [ ] 1.2.2: Implementar método `selectBestProvider()`:
  - Input: `SwapRequest`
  - Output: `Promise<{ provider: ISwapProvider, quote: SwapQuote }>`
  - Lógica:
    1. Criar `RouteParams` do request
    2. Checar quais providers suportam a rota (parallel checks)
    3. Se same-chain: priorizar Uniswap
    4. Se cross-chain: priorizar Thirdweb
    5. Se provider preferido falhar: tentar fallback
    6. Retornar provider + quote

- [ ] 1.2.3: Implementar logging detalhado:
  ```typescript
  console.log('[Router] Checking providers:', providers.map(p => p.name));
  console.log('[Router] ✅ Selected provider:', provider.name);
  console.log('[Router] ⚠️ Fallback triggered:', error.message);
  ```

- [ ] 1.2.4: Implementar error handling:
  - Se nenhum provider suporta: `throw new Error('No provider supports this route')`
  - Se todos falharem: `throw new Error('All providers failed')` com agregação de erros

- [ ] 1.2.5: Adicionar método auxiliar `isSameChain()`:
  ```typescript
  private isSameChain(request: SwapRequest): boolean {
    return request.fromChainId === request.toChainId;
  }
  ```

- [ ] 1.2.6: (Opcional) Implementar método `getProviderByName()`:
  ```typescript
  getProviderByName(name: string): ISwapProvider | undefined
  ```

**Arquivos de referência:**
- Estudar: `src/domain/services/swap.domain.service.ts` (padrão de domain services)

**Validação:**
- ✅ Lógica de routing compila
- ✅ Error handling implementado
- ✅ Logging em todos os pontos críticos
- ✅ Testes mentais: same-chain routes para Uniswap, cross-chain para Thirdweb

---

#### **TASK 1.3: Criar ProviderSelectorService**
**Arquivo:** `src/application/services/provider-selector.service.ts`

**Sub-tasks:**
- [ ] 1.3.1: Criar classe `ProviderSelectorService`:
  ```typescript
  constructor(private readonly router: RouterDomainService)
  ```

- [ ] 1.3.2: Implementar `getQuoteWithBestProvider()`:
  - Input: `SwapRequest`
  - Output: `Promise<{ provider: string, quote: SwapQuote }>`
  - Delegar para `router.selectBestProvider()`
  - Retornar nome do provider (string) ao invés da instância

- [ ] 1.3.3: Implementar `prepareSwapWithProvider()`:
  - Input: `SwapRequest, preferredProvider?: string`
  - Output: `Promise<PreparedSwap>`
  - Se `preferredProvider` especificado: buscar no router e usar
  - Senão: auto-selecionar via router
  - Chamar `provider.prepareSwap()`

- [ ] 1.3.4: Adicionar validação de provider name:
  ```typescript
  if (preferredProvider && !router.hasProvider(preferredProvider)) {
    throw new Error(`Provider '${preferredProvider}' not available`);
  }
  ```

- [ ] 1.3.5: Adicionar logging:
  ```typescript
  console.log('[ProviderSelector] Using preferred provider:', preferredProvider);
  console.log('[ProviderSelector] Auto-selected provider:', provider.name);
  ```

**Arquivos de referência:**
- Estudar: `src/application/services/price.service.ts` (padrão de application services)

**Validação:**
- ✅ Service compila
- ✅ Delegação correta para router
- ✅ Handling de provider preferido funciona
- ✅ Retorna tipos corretos (string para provider name)

---

#### **TASK 1.4: Estender Domain Entities (se necessário)**
**Arquivo:** `src/domain/entities/swap.ts`

**Sub-tasks:**
- [ ] 1.4.1: Revisar `SwapQuote` - adicionar campo opcional `provider`?
  ```typescript
  constructor(
    // ... existing params
    public readonly provider?: string // Nome do provider usado
  )
  ```

- [ ] 1.4.2: Revisar `SwapResult` - adicionar metadata do provider?
  ```typescript
  public readonly metadata?: {
    provider: string;
    routing?: string; // 'CLASSIC', 'DUTCH_V2', 'BRIDGE'
    originalQuote?: any;
  }
  ```

- [ ] 1.4.3: (Opcional) Criar enum `SwapProvider`:
  ```typescript
  export enum SwapProvider {
    UNISWAP = 'uniswap',
    THIRDWEB = 'thirdweb'
  }
  ```

- [ ] 1.4.4: Adicionar JSDoc nos novos campos

**Validação:**
- ✅ Entidades existentes não quebradas (backward compatible)
- ✅ Novos campos opcionais
- ✅ Compilação sem erros

---

### **Checkpoints da FASE 1:**

**Antes de prosseguir para FASE 2, validar:**
- ✅ Todos os arquivos compilam sem erros TypeScript
- ✅ Interfaces bem documentadas (JSDoc completo)
- ✅ Padrão arquitetural consistente com código existente
- ✅ Git commit: `feat(domain): add multi-provider swap architecture`

**Arquivos criados:**
1. `src/domain/ports/swap.provider.port.ts`
2. `src/domain/services/router.domain.service.ts`
3. `src/application/services/provider-selector.service.ts`

**Arquivos modificados:**
1. `src/domain/entities/swap.ts` (se necessário)

---

## 📊 FASE 2: BACKEND - UNISWAP ADAPTER

### **Objetivo:** Implementar Uniswap Trading API adapter completo seguindo padrão ISwapProvider

### **Tasks Detalhadas:**

#### **TASK 2.1: Setup & Configuration**

**Sub-tasks:**
- [ ] 2.1.1: Adicionar variáveis de ambiente no `.env`:
  ```bash
  # Uniswap Trading API
  UNISWAP_API_KEY=your_api_key_here
  UNISWAP_API_URL=https://api.gateway.uniswap.org/v2

  # Feature flags
  UNISWAP_ENABLED=true
  UNISWAP_SAME_CHAIN_ONLY=true
  ```

- [ ] 2.1.2: Adicionar validation no startup (`src/index.ts`):
  ```typescript
  if (process.env.UNISWAP_ENABLED === 'true' && !process.env.UNISWAP_API_KEY) {
    console.warn('⚠️ UNISWAP_ENABLED=true but UNISWAP_API_KEY not set');
  }
  ```

- [ ] 2.1.3: Criar arquivo de constantes `src/infrastructure/adapters/uniswap/constants.ts`:
  ```typescript
  export const UNISWAP_SUPPORTED_CHAINS = new Set([
    1,      // Ethereum
    10,     // Optimism
    137,    // Polygon
    8453,   // Base
    42161,  // Arbitrum
    43114,  // Avalanche
    56,     // BSC
    324,    // ZKSync
    81457,  // Blast
    7777777,// Zora
    130,    // Unichain
    480,    // World Chain
  ]);

  export const UNISWAP_API_ENDPOINTS = {
    CHECK_APPROVAL: '/check_approval',
    QUOTE: '/quote',
    SWAP: '/swap',
    ORDER: '/order',
    ORDERS: '/orders',
  };
  ```

- [ ] 2.1.4: Instalar dependências (se necessário):
  ```bash
  # Já temos axios, mas verificar versão
  npm list axios
  ```

**Validação:**
- ✅ `.env` configurado
- ✅ Constantes definidas
- ✅ Startup validation funcionando

---

#### **TASK 2.2: Criar Uniswap API Client (camada de comunicação)**
**Arquivo:** `src/infrastructure/adapters/uniswap/uniswap.api.client.ts`

**Sub-tasks:**
- [ ] 2.2.1: Criar classe `UniswapAPIClient`:
  ```typescript
  export class UniswapAPIClient {
    private readonly baseURL: string;
    private readonly apiKey: string;
    private readonly axiosInstance: AxiosInstance;

    constructor(apiKey: string, baseURL?: string) {
      this.apiKey = apiKey;
      this.baseURL = baseURL || process.env.UNISWAP_API_URL!;
      this.axiosInstance = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        timeout: 30000, // 30s timeout
      });
    }
  }
  ```

- [ ] 2.2.2: Implementar método `checkApproval()`:
  ```typescript
  async checkApproval(params: CheckApprovalParams): Promise<CheckApprovalResponse> {
    const response = await this.axiosInstance.post('/check_approval', params);
    return response.data;
  }
  ```

- [ ] 2.2.3: Implementar método `getQuote()`:
  ```typescript
  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    const response = await this.axiosInstance.post('/quote', params);
    return response.data;
  }
  ```

- [ ] 2.2.4: Implementar método `createSwap()`:
  ```typescript
  async createSwap(params: SwapParams): Promise<SwapResponse> {
    const response = await this.axiosInstance.post('/swap', params);
    return response.data;
  }
  ```

- [ ] 2.2.5: Implementar método `createOrder()` (UniswapX):
  ```typescript
  async createOrder(params: OrderParams): Promise<OrderResponse> {
    const response = await this.axiosInstance.post('/order', params);
    return response.data;
  }
  ```

- [ ] 2.2.6: Implementar método `getOrderStatus()`:
  ```typescript
  async getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    const response = await this.axiosInstance.get(`/orders?orderId=${orderId}`);
    return response.data;
  }
  ```

- [ ] 2.2.7: Implementar error handling:
  ```typescript
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;

        if (status === 401) {
          throw new Error('Uniswap API: Invalid API key');
        }
        if (status === 419) {
          throw new Error('Uniswap API: Rate limit exceeded');
        }
        if (status === 404) {
          throw new Error('Uniswap API: No route found');
        }

        throw new Error(
          `Uniswap API error (${status}): ${data?.message || error.message}`
        );
      }
      throw error;
    }
  }
  ```

- [ ] 2.2.8: Implementar retry logic com exponential backoff:
  ```typescript
  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.request<T>(config);
      } catch (error) {
        lastError = error as Error;

        // Não retry em erros de auth ou validation
        if (error.message.includes('Invalid API key') ||
            error.message.includes('No route found')) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
  ```

- [ ] 2.2.9: Criar interfaces TypeScript para API (em arquivo separado):
  **Arquivo:** `src/infrastructure/adapters/uniswap/types.ts`

  ```typescript
  // Quote Request/Response
  export interface QuoteParams {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    recipient: string;
    slippage: string; // e.g., "0.5" for 0.5%
    chainId: number;
  }

  export interface QuoteResponse {
    routing: 'CLASSIC' | 'DUTCH_V2' | 'DUTCH_V3' | 'BRIDGE';
    quote: {
      amount: string;
      amountDecimals: string;
      priceImpact: string;
      slippage: string;
    };
    gasFee?: string;
    gasUseEstimate?: string;
    route?: Array<{
      pool: string;
      tokenIn: string;
      tokenOut: string;
      protocol: 'V2' | 'V3' | 'V4';
    }>;
  }

  // Check Approval Request/Response
  export interface CheckApprovalParams {
    walletAddress: string;
    token: string;
    amount: string;
    chainId: number;
  }

  export interface CheckApprovalResponse {
    approval: {
      isRequired: boolean;
      permitData?: {
        domain: any;
        types: any;
        values: any;
      };
    };
  }

  // Swap Request/Response
  export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    recipient: string;
    slippage: string;
    chainId: number;
    permitData?: {
      signature: string;
      permitSingle: any;
    };
  }

  export interface SwapResponse {
    transactionRequest: {
      to: string;
      data: string;
      value: string;
      chainId: number;
      gasLimit?: string;
    };
  }

  // Order (UniswapX) Request/Response
  export interface OrderParams {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    swapper: string;
    slippage: string;
    chainId: number;
  }

  export interface OrderResponse {
    orderId: string;
    orderHash: string;
    signature: string;
    encodedOrder: string;
  }

  export interface OrderStatusResponse {
    orders: Array<{
      orderId: string;
      status: 'open' | 'filled' | 'expired' | 'cancelled' | 'error';
      filledAt?: number;
      txHash?: string;
    }>;
  }
  ```

- [ ] 2.2.10: Adicionar logging detalhado:
  ```typescript
  console.log('[UniswapAPI] Request:', method, endpoint, params);
  console.log('[UniswapAPI] Response:', response.status, response.data);
  console.log('[UniswapAPI] Error:', error.message, error.response?.data);
  ```

**Validação:**
- ✅ Client compila sem erros
- ✅ Tipos TypeScript completos e exportados
- ✅ Error handling robusto (401, 404, 419, 500)
- ✅ Retry logic implementado
- ✅ Logging em todos os endpoints
- ✅ Timeout configurado (30s)

---

#### **TASK 2.3: Criar UniswapProviderAdapter (implementação de ISwapProvider)**
**Arquivo:** `src/infrastructure/adapters/uniswap.provider.adapter.ts`

**Sub-tasks:**
- [ ] 2.3.1: Criar classe base:
  ```typescript
  import { ISwapProvider, RouteParams, PreparedSwap } from '../../domain/ports/swap.provider.port';
  import { SwapRequest, SwapQuote, TransactionStatus } from '../../domain/entities/swap';
  import { UniswapAPIClient } from './uniswap/uniswap.api.client';
  import { UNISWAP_SUPPORTED_CHAINS } from './uniswap/constants';

  export class UniswapProviderAdapter implements ISwapProvider {
    public readonly name = 'uniswap';

    private readonly client: UniswapAPIClient;
    private readonly enabled: boolean;

    constructor() {
      const apiKey = process.env.UNISWAP_API_KEY || '';
      this.enabled = process.env.UNISWAP_ENABLED === 'true' && !!apiKey;

      if (!apiKey && this.enabled) {
        console.warn('[UniswapProvider] API key not configured - provider disabled');
        this.enabled = false;
      }

      this.client = new UniswapAPIClient(apiKey);
      console.log(`[UniswapProvider] Initialized (enabled: ${this.enabled})`);
    }
  }
  ```

- [ ] 2.3.2: Implementar `supportsRoute()`:
  ```typescript
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // 1. Check if enabled
    if (!this.enabled) {
      console.log('[UniswapProvider] Provider disabled');
      return false;
    }

    // 2. Check same-chain only (Uniswap API doesn't do bridges)
    if (params.fromChainId !== params.toChainId) {
      console.log('[UniswapProvider] Cross-chain not supported');
      return false;
    }

    // 3. Check chain support
    if (!UNISWAP_SUPPORTED_CHAINS.has(params.fromChainId)) {
      console.log(`[UniswapProvider] Chain ${params.fromChainId} not supported`);
      return false;
    }

    console.log('[UniswapProvider] ✅ Route supported');
    return true;
  }
  ```

- [ ] 2.3.3: Implementar `getQuote()`:
  ```typescript
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    console.log('[UniswapProvider] Getting quote:', request.toLogString());

    try {
      // Call Uniswap API /quote
      const quoteResponse = await this.client.getQuote({
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        amount: request.amount.toString(),
        type: 'EXACT_INPUT',
        recipient: request.receiver,
        slippage: '0.5', // 0.5% default (TODO: make configurable)
        chainId: request.fromChainId,
      });

      // Parse response to domain entity
      const estimatedReceiveAmount = BigInt(quoteResponse.quote.amount);
      const bridgeFee = BigInt(0); // N/A for same-chain
      const gasFee = this.parseGasFee(quoteResponse);
      const exchangeRate = this.calculateExchangeRate(
        request.amount,
        estimatedReceiveAmount
      );
      const estimatedDuration = this.getEstimatedDuration(quoteResponse.routing);

      const quote = new SwapQuote(
        estimatedReceiveAmount,
        bridgeFee,
        gasFee,
        exchangeRate,
        estimatedDuration
      );

      console.log('[UniswapProvider] ✅ Quote obtained:', {
        amount: estimatedReceiveAmount.toString(),
        routing: quoteResponse.routing,
        gasFee: gasFee.toString(),
      });

      return quote;
    } catch (error) {
      console.error('[UniswapProvider] Quote failed:', error);
      throw new Error(`Uniswap quote failed: ${error.message}`);
    }
  }
  ```

- [ ] 2.3.4: Implementar helper `parseGasFee()`:
  ```typescript
  private parseGasFee(quoteResponse: QuoteResponse): bigint {
    if (quoteResponse.gasFee) {
      return BigInt(quoteResponse.gasFee);
    }

    // Fallback: estimate from gasUseEstimate
    if (quoteResponse.gasUseEstimate) {
      // TODO: Get real gas price from Thirdweb or RPC
      // For now, use conservative estimate
      const gasLimit = BigInt(quoteResponse.gasUseEstimate);
      const gasPrice = BigInt(30_000_000_000); // 30 gwei
      return gasLimit * gasPrice;
    }

    // Last resort: conservative estimate
    console.warn('[UniswapProvider] No gas data in quote, using fallback');
    return BigInt(300000 * 30_000_000_000); // 300k gas @ 30 gwei
  }
  ```

- [ ] 2.3.5: Implementar helper `calculateExchangeRate()`:
  ```typescript
  private calculateExchangeRate(
    amountIn: bigint,
    amountOut: bigint
  ): number {
    // TODO: Adjust for token decimals (get from token.utils.ts)
    const inNumber = Number(amountIn);
    const outNumber = Number(amountOut);

    if (inNumber === 0) return 0;

    return outNumber / inNumber;
  }
  ```

- [ ] 2.3.6: Implementar helper `getEstimatedDuration()`:
  ```typescript
  private getEstimatedDuration(routing: string): number {
    switch (routing) {
      case 'CLASSIC':
        return 30; // 30 seconds for V2/V3/V4 swaps
      case 'DUTCH_V2':
      case 'DUTCH_V3':
        return 120; // 2 minutes for UniswapX orders
      case 'BRIDGE':
        return 600; // 10 minutes for bridges (shouldn't happen in same-chain)
      default:
        return 60; // 1 minute default
    }
  }
  ```

- [ ] 2.3.7: Implementar `prepareSwap()`:
  ```typescript
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    console.log('[UniswapProvider] Preparing swap:', request.toLogString());

    try {
      // Step 1: Get fresh quote
      const quoteResponse = await this.client.getQuote({
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        amount: request.amount.toString(),
        type: 'EXACT_INPUT',
        recipient: request.receiver,
        slippage: '0.5',
        chainId: request.fromChainId,
      });

      const routing = quoteResponse.routing;
      console.log('[UniswapProvider] Quote routing:', routing);

      // Step 2: Check approval
      const approvalCheck = await this.client.checkApproval({
        walletAddress: request.sender,
        token: request.fromToken,
        amount: request.amount.toString(),
        chainId: request.fromChainId,
      });

      const transactions: Transaction[] = [];

      // Step 3: Add approval transaction if needed
      if (approvalCheck.approval.isRequired) {
        console.log('[UniswapProvider] Approval required');

        // Uniswap uses Permit2 signatures (gasless approval)
        // Return permit data for frontend to sign
        if (approvalCheck.approval.permitData) {
          console.log('[UniswapProvider] ⚠️ Permit2 signature required');
          throw new Error(
            'PERMIT2_SIGNATURE_REQUIRED: Frontend must sign Permit2 message. ' +
            'PermitData: ' + JSON.stringify(approvalCheck.approval.permitData)
          );
        }

        // Fallback: traditional approval (shouldn't happen with modern Uniswap)
        throw new Error('APPROVAL_REQUIRED: Token approval needed');
      }

      // Step 4: Create swap transaction based on routing
      let swapTx: Transaction;

      if (routing === 'CLASSIC') {
        // V2/V3/V4 swap (gasful)
        const swapResponse = await this.client.createSwap({
          tokenIn: request.fromToken,
          tokenOut: request.toToken,
          amount: request.amount.toString(),
          type: 'EXACT_INPUT',
          recipient: request.receiver,
          slippage: '0.5',
          chainId: request.fromChainId,
        });

        swapTx = {
          chainId: swapResponse.transactionRequest.chainId,
          to: swapResponse.transactionRequest.to,
          data: swapResponse.transactionRequest.data,
          value: swapResponse.transactionRequest.value,
          gasLimit: swapResponse.transactionRequest.gasLimit,
        };
      } else {
        // UniswapX order (gasless)
        const orderResponse = await this.client.createOrder({
          tokenIn: request.fromToken,
          tokenOut: request.toToken,
          amount: request.amount.toString(),
          type: 'EXACT_INPUT',
          swapper: request.sender,
          slippage: '0.5',
          chainId: request.fromChainId,
        });

        console.log('[UniswapProvider] UniswapX order created:', orderResponse.orderId);

        // For UniswapX, return order signature transaction
        swapTx = {
          chainId: request.fromChainId,
          to: '0x0000000000000000000000000000000000000000', // No on-chain TX
          data: orderResponse.encodedOrder,
          value: '0',
        };
      }

      transactions.push(swapTx);

      // Step 5: Return prepared swap
      const prepared: PreparedSwap = {
        provider: this.name,
        transactions,
        estimatedDuration: this.getEstimatedDuration(routing),
        expiresAt: new Date(Date.now() + 60000), // 1 minute expiry
        metadata: {
          routing,
          quoteResponse,
        },
      };

      console.log('[UniswapProvider] ✅ Swap prepared:', {
        transactions: transactions.length,
        routing,
      });

      return prepared;
    } catch (error) {
      console.error('[UniswapProvider] Prepare swap failed:', error);
      throw error;
    }
  }
  ```

- [ ] 2.3.8: Implementar `monitorTransaction()`:
  ```typescript
  async monitorTransaction(
    txHash: string,
    chainId: number
  ): Promise<TransactionStatus> {
    console.log('[UniswapProvider] Monitoring TX:', txHash);

    // For CLASSIC swaps: monitor on-chain transaction
    if (txHash.startsWith('0x')) {
      // Delegate to Thirdweb or ChainProvider for TX monitoring
      // TODO: Implement using existing ChainProviderAdapter
      return TransactionStatus.PENDING;
    }

    // For UniswapX orders: monitor order status
    try {
      const statusResponse = await this.client.getOrderStatus(txHash);

      if (statusResponse.orders.length === 0) {
        return TransactionStatus.PENDING;
      }

      const order = statusResponse.orders[0];

      switch (order.status) {
        case 'filled':
          return TransactionStatus.COMPLETED;
        case 'error':
        case 'cancelled':
          return TransactionStatus.FAILED;
        default:
          return TransactionStatus.PENDING;
      }
    } catch (error) {
      console.error('[UniswapProvider] Monitor failed:', error);
      return TransactionStatus.PENDING;
    }
  }
  ```

- [ ] 2.3.9: Adicionar métodos auxiliares para tokens:
  ```typescript
  private async getTokenDecimals(
    tokenAddress: string,
    chainId: number
  ): Promise<number> {
    // Use existing token.utils.ts
    const { getTokenDecimals } = await import('../../utils/token.utils');
    return getTokenDecimals(tokenAddress, chainId);
  }
  ```

- [ ] 2.3.10: Adicionar handling de native tokens:
  ```typescript
  private normalizeTokenAddress(token: string): string {
    // Uniswap API expects native token as '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    const { isNativeToken, NATIVE_TOKEN_ADDRESS } = await import('../../utils/native.utils');

    if (isNativeToken(token)) {
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    return token;
  }
  ```

**Validação:**
- ✅ Adapter implementa toda interface ISwapProvider
- ✅ Error handling completo (PERMIT2_SIGNATURE_REQUIRED, etc.)
- ✅ Logging detalhado em cada passo
- ✅ Suporta CLASSIC swaps e UniswapX orders
- ✅ Native token normalization
- ✅ Token decimals handling
- ✅ Compila sem erros TypeScript

---

#### **TASK 2.4: Integração com Utils Existentes**

**Sub-tasks:**
- [ ] 2.4.1: Atualizar `src/utils/native.utils.ts` (se necessário):
  - Adicionar constante `UNISWAP_NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'`
  - Criar função `toUniswapNativeFormat(token: string): string`

- [ ] 2.4.2: Atualizar `src/utils/token.utils.ts` (se necessário):
  - Verificar se `getTokenDecimals()` existe e funciona
  - Adicionar cache de decimals (Map) se não houver

- [ ] 2.4.3: Criar utility para gas price:
  **Arquivo:** `src/utils/gas.utils.ts`
  ```typescript
  import { ChainProviderAdapter } from '../infrastructure/adapters/chain.provider.adapter';

  export async function getGasPrice(chainId: number): Promise<bigint> {
    // Use Thirdweb priority (conforme requisito)
    const provider = new ChainProviderAdapter().getProvider(chainId);
    const gasPrice = await provider.getGasPrice();
    return BigInt(gasPrice.toString());
  }
  ```

- [ ] 2.4.4: Integrar gas price real no `parseGasFee()`:
  ```typescript
  import { getGasPrice } from '../../utils/gas.utils';

  private async parseGasFee(quoteResponse: QuoteResponse, chainId: number): Promise<bigint> {
    if (quoteResponse.gasFee) {
      return BigInt(quoteResponse.gasFee);
    }

    if (quoteResponse.gasUseEstimate) {
      const gasLimit = BigInt(quoteResponse.gasUseEstimate);
      const gasPrice = await getGasPrice(chainId); // REAL gas price
      return gasLimit * gasPrice;
    }

    // Fallback
    const gasPrice = await getGasPrice(chainId);
    return BigInt(300000) * gasPrice;
  }
  ```

**Validação:**
- ✅ Utils integrados corretamente
- ✅ Gas price vem de Thirdweb (prioridade)
- ✅ Native token handling consistente
- ✅ Token decimals funcionando

---

### **Checkpoints da FASE 2:**

**Antes de prosseguir para FASE 3, validar:**
- ✅ UniswapAPIClient funciona (testar com mock ou API real)
- ✅ UniswapProviderAdapter implementa ISwapProvider completamente
- ✅ Tipos TypeScript completos e sem erros
- ✅ Error handling robusto
- ✅ Logging detalhado
- ✅ Utils integrados (gas, tokens, native)
- ✅ Git commit: `feat(uniswap): implement Uniswap Trading API adapter`

**Arquivos criados:**
1. `src/infrastructure/adapters/uniswap/constants.ts`
2. `src/infrastructure/adapters/uniswap/types.ts`
3. `src/infrastructure/adapters/uniswap/uniswap.api.client.ts`
4. `src/infrastructure/adapters/uniswap.provider.adapter.ts`
5. `src/utils/gas.utils.ts`

**Arquivos modificados:**
1. `.env` (variáveis Uniswap)
2. `src/utils/native.utils.ts` (se necessário)
3. `src/utils/token.utils.ts` (se necessário)

---

## 📊 FASE 3: BACKEND - ROUTER & INTEGRATION

### **Objetivo:** Integrar routing inteligente no sistema existente sem quebrar funcionalidade atual

### **Tasks Detalhadas:**

#### **TASK 3.1: Refatorar ThirdwebSwapAdapter para ISwapProvider**

**Arquivo:** `src/infrastructure/adapters/thirdweb.swap.adapter.ts`

**Sub-tasks:**
- [ ] 3.1.1: Renomear classe (manter backward compatibility):
  ```typescript
  // Keep old name as alias
  export class ThirdwebSwapAdapter implements ISwapService, ISwapProvider {
    public readonly name = 'thirdweb';
    // ... existing code
  }

  // Export new name
  export { ThirdwebSwapAdapter as ThirdwebProviderAdapter };
  ```

- [ ] 3.1.2: Implementar `supportsRoute()`:
  ```typescript
  async supportsRoute(params: RouteParams): Promise<boolean> {
    // Thirdweb Bridge supports ANY route (same-chain and cross-chain)
    // It's the universal fallback

    // Check if chains are supported by Thirdweb
    const fromSupported = this.chainProvider.isChainSupported(params.fromChainId);
    const toSupported = this.chainProvider.isChainSupported(params.toChainId);

    if (!fromSupported || !toSupported) {
      console.log(`[ThirdwebProvider] Chain not supported:`, {
        from: params.fromChainId,
        to: params.toChainId,
      });
      return false;
    }

    console.log('[ThirdwebProvider] ✅ Route supported');
    return true;
  }
  ```

- [ ] 3.1.3: Manter métodos de `ISwapService` (não quebrar):
  - `getQuote()` ✅ já existe
  - `prepareSwap()` ✅ já existe
  - `executeSwap()` ✅ já existe
  - `monitorTransaction()` ✅ já existe

- [ ] 3.1.4: Adaptar `prepareSwap()` para retornar `PreparedSwap`:
  ```typescript
  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    // Existing code that prepares transactions...
    const transactions = await this.prepareTransactions(request);

    return {
      provider: this.name,
      transactions: transactions.map(tx => ({
        chainId: tx.chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value.toString(),
        gasLimit: tx.gasLimit?.toString(),
      })),
      estimatedDuration: this.estimateDuration(request),
      metadata: {
        // Include Thirdweb-specific data
        route: 'bridge',
      },
    };
  }
  ```

- [ ] 3.1.5: Adicionar helper `estimateDuration()`:
  ```typescript
  private estimateDuration(request: SwapRequest): number {
    const isSameChain = request.fromChainId === request.toChainId;

    if (isSameChain) {
      return 60; // 1 minute for same-chain
    }

    // Cross-chain: depends on chains
    // L1 -> L1: ~15 minutes
    // L1 -> L2: ~10 minutes
    // L2 -> L2: ~5 minutes
    return 600; // 10 minutes average
  }
  ```

- [ ] 3.1.6: Verificar compatibilidade com DI Container:
  - Checar que constructor não mudou
  - Checar que métodos existentes funcionam igual

**Validação:**
- ✅ ThirdwebSwapAdapter implementa ISwapProvider E ISwapService
- ✅ Código existente não quebra
- ✅ Backward compatibility mantida
- ✅ `supportsRoute()` implementado
- ✅ `prepareSwap()` retorna PreparedSwap

---

#### **TASK 3.2: Atualizar DI Container**

**Arquivo:** `src/infrastructure/di/container.ts`

**Sub-tasks:**
- [ ] 3.2.1: Adicionar imports:
  ```typescript
  import { UniswapProviderAdapter } from '../adapters/uniswap.provider.adapter';
  import { RouterDomainService } from '../../domain/services/router.domain.service';
  import { ProviderSelectorService } from '../../application/services/provider-selector.service';
  import { ISwapProvider } from '../../domain/ports/swap.provider.port';
  ```

- [ ] 3.2.2: Adicionar propriedades privadas:
  ```typescript
  export class DIContainer {
    // ... existing properties

    // NEW: Providers
    private readonly _uniswapProvider: UniswapProviderAdapter;
    private readonly _thirdwebProvider: ThirdwebSwapAdapter; // Também é ISwapProvider agora

    // NEW: Router & Selector
    private readonly _router: RouterDomainService;
    private readonly _providerSelector: ProviderSelectorService;

    // ... rest
  }
  ```

- [ ] 3.2.3: Atualizar constructor - inicializar providers:
  ```typescript
  private constructor() {
    console.log("[DIContainer] Initializing with multi-provider routing");

    // Initialize adapters (EXISTING)
    this._chainProviderAdapter = new ChainProviderAdapter();
    this._swapRepositoryAdapter = new SwapRepositoryAdapter();

    // Initialize providers (NEW)
    this._uniswapProvider = new UniswapProviderAdapter();
    this._thirdwebProvider = new ThirdwebSwapAdapter(
      this._chainProviderAdapter,
      this._swapRepositoryAdapter
    );

    console.log("[DIContainer] Providers initialized:", {
      uniswap: this._uniswapProvider.name,
      thirdweb: this._thirdwebProvider.name,
    });

    // ... rest of existing initialization
  }
  ```

- [ ] 3.2.4: Atualizar constructor - inicializar router:
  ```typescript
  // NEW: Initialize router with providers map
  const providersMap = new Map<string, ISwapProvider>([
    ['uniswap', this._uniswapProvider],
    ['thirdweb', this._thirdwebProvider],
  ]);

  this._router = new RouterDomainService(providersMap);
  console.log("[DIContainer] Router configured with", providersMap.size, "providers");
  ```

- [ ] 3.2.5: Atualizar constructor - inicializar selector:
  ```typescript
  // NEW: Initialize provider selector
  this._providerSelector = new ProviderSelectorService(this._router);
  console.log("[DIContainer] Provider selector ready");
  ```

- [ ] 3.2.6: Manter inicialização existente de domain services:
  ```typescript
  // EXISTING: Domain services (keep as is)
  this._swapDomainService = new SwapDomainService(
    this._thirdwebProvider, // Still use thirdweb for backward compatibility
    this._chainProviderAdapter,
    this._swapRepositoryAdapter
  );
  ```

- [ ] 3.2.7: Adicionar getters para novos componentes:
  ```typescript
  public get router(): RouterDomainService {
    return this._router;
  }

  public get providerSelector(): ProviderSelectorService {
    return this._providerSelector;
  }

  public get uniswapProvider(): UniswapProviderAdapter {
    return this._uniswapProvider;
  }
  ```

- [ ] 3.2.8: Verificar ordem de inicialização:
  - ✅ Adapters primeiro (chain, repository)
  - ✅ Providers depois (precisam de adapters)
  - ✅ Router depois (precisa de providers)
  - ✅ Selector depois (precisa de router)
  - ✅ Domain services depois (backward compatibility)
  - ✅ Use cases por último

**Validação:**
- ✅ DI Container compila
- ✅ Ordem de inicialização correta
- ✅ Logs informativos
- ✅ Getters funcionando
- ✅ Backward compatibility (SwapDomainService ainda funciona)

---

#### **TASK 3.3: Atualizar GetQuoteUseCase**

**Arquivo:** `src/application/usecases/get.quote.usecase.ts`

**Sub-tasks:**
- [ ] 3.3.1: Adicionar injeção de ProviderSelectorService:
  ```typescript
  export class GetQuoteUseCase {
    constructor(
      private readonly swapDomainService: SwapDomainService, // KEEP for backward compat
      private readonly providerSelector: ProviderSelectorService // NEW
    ) {}
  }
  ```

- [ ] 3.3.2: Modificar método `execute()` - usar provider selector:
  ```typescript
  public async execute(request: GetQuoteUseCaseRequest): Promise<GetQuoteUseCaseResponse> {
    console.log("[GetQuoteUseCase] Processing quote request");

    // ... existing validation code

    const swapRequest = new SwapRequest(
      request.fromChainId,
      request.toChainId,
      request.fromToken,
      request.toToken,
      amount,
      request.sender || "0x0",
      request.receiver || request.sender || "0x0"
    );

    // NEW: Use provider selector
    const { provider, quote } = await this.providerSelector.getQuoteWithBestProvider(
      swapRequest
    );

    console.log(`[GetQuoteUseCase] ✅ Selected provider: ${provider}`);

    // ... existing USD enrichment code

    return {
      estimatedReceiveAmount: quote.estimatedReceiveAmount.toString(),
      bridgeFee: quote.bridgeFee.toString(),
      gasFee: quote.gasFee.toString(),
      exchangeRate: quote.exchangeRate,
      estimatedDuration: quote.estimatedDuration,
      provider, // NEW field
      // ... rest of response
    };
  }
  ```

- [ ] 3.3.3: Adicionar campo `provider` no response type:
  ```typescript
  export interface GetQuoteUseCaseResponse {
    estimatedReceiveAmount: string;
    bridgeFee: string;
    gasFee: string;
    exchangeRate: number;
    estimatedDuration: number;
    provider: string; // NEW: 'uniswap' | 'thirdweb'
    // ... existing fields
  }
  ```

- [ ] 3.3.4: Adicionar fallback handling:
  ```typescript
  try {
    const { provider, quote } = await this.providerSelector.getQuoteWithBestProvider(
      swapRequest
    );
    // ... success path
  } catch (error) {
    console.error('[GetQuoteUseCase] Provider selection failed:', error);

    // Fallback: try direct Thirdweb call (backward compatibility)
    console.log('[GetQuoteUseCase] Attempting Thirdweb fallback');
    const quote = await this.swapDomainService.getQuote(swapRequest);

    return {
      // ... response with provider: 'thirdweb'
      provider: 'thirdweb',
    };
  }
  ```

**Validação:**
- ✅ Use case compila
- ✅ Provider selector integrado
- ✅ Response type atualizado
- ✅ Fallback funcionando
- ✅ Backward compatibility mantida

---

#### **TASK 3.4: Atualizar PrepareSwapUseCase**

**Arquivo:** `src/application/usecases/prepare.swap.usecase.ts`

**Sub-tasks:**
- [ ] 3.4.1: Adicionar injeção de ProviderSelectorService:
  ```typescript
  export class PrepareSwapUseCase {
    constructor(
      private readonly swapDomainService: SwapDomainService, // KEEP
      private readonly providerSelector: ProviderSelectorService // NEW
    ) {}
  }
  ```

- [ ] 3.4.2: Modificar método `execute()`:
  ```typescript
  public async execute(request: PrepareSwapUseCaseRequest): Promise<PrepareSwapUseCaseResponse> {
    console.log("[PrepareSwapUseCase] Preparing swap");

    // ... existing validation

    const swapRequest = new SwapRequest(/* ... */);

    // NEW: Use provider selector
    const preferredProvider = request.preferredProvider; // Optional from user

    const preparedSwap = await this.providerSelector.prepareSwapWithProvider(
      swapRequest,
      preferredProvider
    );

    console.log(`[PrepareSwapUseCase] ✅ Prepared with ${preparedSwap.provider}`);

    return {
      transactions: preparedSwap.transactions,
      estimatedDuration: preparedSwap.estimatedDuration,
      expiresAt: preparedSwap.expiresAt,
      provider: preparedSwap.provider,
      metadata: preparedSwap.metadata,
    };
  }
  ```

- [ ] 3.4.3: Adicionar `preferredProvider` no request type:
  ```typescript
  export interface PrepareSwapUseCaseRequest {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string;
    sender: string;
    receiver: string;
    preferredProvider?: 'uniswap' | 'thirdweb'; // NEW: optional
  }
  ```

- [ ] 3.4.4: Atualizar response type:
  ```typescript
  export interface PrepareSwapUseCaseResponse {
    transactions: Transaction[];
    estimatedDuration: number;
    expiresAt?: Date;
    provider: string; // NEW
    metadata?: Record<string, any>; // NEW
  }
  ```

**Validação:**
- ✅ Use case compila
- ✅ Provider preference funcionando
- ✅ Response types atualizados

---

#### **TASK 3.5: Atualizar SwapController**

**Arquivo:** `src/infrastructure/http/controllers/swap.controller.ts`

**Sub-tasks:**
- [ ] 3.5.1: Atualizar método `getQuote()` - expor provider:
  ```typescript
  public getQuote = async (req: Request, res: Response): Promise<void> => {
    try {
      // ... existing code

      const quote = await this.getQuoteUseCase.execute({
        // ... params
      });

      res.json({
        success: true,
        quote,
        metadata: {
          provider: quote.provider, // NEW: inform frontend
          routingStrategy: 'auto',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // ... error handling
    }
  };
  ```

- [ ] 3.5.2: Atualizar método `prepareSwap()` - aceitar preferredProvider:
  ```typescript
  public prepareSwap = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        receiver,
        preferredProvider, // NEW: optional from frontend
      } = req.body;

      const sender = (req as any).user?.address;

      const result = await this.prepareSwapUseCase.execute({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        sender,
        receiver: receiver || sender,
        preferredProvider, // NEW: pass to use case
      });

      res.json({
        success: true,
        ...result,
        metadata: {
          provider: result.provider,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Handle PERMIT2_SIGNATURE_REQUIRED error
      if (error.message?.includes('PERMIT2_SIGNATURE_REQUIRED')) {
        return res.status(400).json({
          success: false,
          error: 'PERMIT2_SIGNATURE_REQUIRED',
          message: 'Permit2 signature required for approval',
          permitData: this.extractPermitData(error.message),
        });
      }

      // ... other error handling
    }
  };
  ```

- [ ] 3.5.3: Adicionar helper para extrair Permit2 data:
  ```typescript
  private extractPermitData(errorMessage: string): any {
    try {
      // Extract JSON from error message
      const match = errorMessage.match(/PermitData: ({.*})/);
      if (match) {
        return JSON.parse(match[1]);
      }
    } catch (e) {
      console.error('[SwapController] Failed to extract permit data');
    }
    return null;
  }
  ```

- [ ] 3.5.4: Atualizar error responses:
  ```typescript
  // Handle Uniswap-specific errors
  if (error.message?.includes('Uniswap API')) {
    return res.status(502).json({
      success: false,
      error: 'UNISWAP_API_ERROR',
      message: error.message,
    });
  }

  if (error.message?.includes('No provider supports')) {
    return res.status(400).json({
      success: false,
      error: 'ROUTE_NOT_SUPPORTED',
      message: 'No swap provider supports this route',
    });
  }
  ```

**Validação:**
- ✅ Controller compila
- ✅ Provider info exposto em responses
- ✅ preferredProvider aceito em requests
- ✅ Error handling para Permit2
- ✅ Error handling para provider failures

---

#### **TASK 3.6: Atualizar DI Container - Wire Use Cases**

**Arquivo:** `src/infrastructure/di/container.ts`

**Sub-tasks:**
- [ ] 3.6.1: Atualizar inicialização de GetQuoteUseCase:
  ```typescript
  this._getQuoteUseCase = new GetQuoteUseCase(
    this._swapDomainService,
    this._providerSelector // NEW: inject selector
  );
  ```

- [ ] 3.6.2: Atualizar inicialização de PrepareSwapUseCase:
  ```typescript
  this._prepareSwapUseCase = new PrepareSwapUseCase(
    this._swapDomainService,
    this._providerSelector // NEW: inject selector
  );
  ```

- [ ] 3.6.3: Verificar que controller recebe use cases atualizados:
  ```typescript
  this._swapController = new SwapController(
    this._getQuoteUseCase,
    this._prepareSwapUseCase,
    // ... other use cases
  );
  ```

**Validação:**
- ✅ DI wiring completo
- ✅ Todas as dependências injetadas
- ✅ Compila sem erros

---

### **Checkpoints da FASE 3:**

**Antes de prosseguir para FASE 4, validar:**
- ✅ Thirdweb adapter implementa ISwapProvider
- ✅ DI Container atualizado com providers + router
- ✅ Use cases usando ProviderSelectorService
- ✅ Controller expondo provider info
- ✅ Backward compatibility mantida (código antigo ainda funciona)
- ✅ Compila sem erros TypeScript
- ✅ Git commit: `feat(routing): integrate multi-provider routing`

**Arquivos modificados:**
1. `src/infrastructure/adapters/thirdweb.swap.adapter.ts`
2. `src/infrastructure/di/container.ts`
3. `src/application/usecases/get.quote.usecase.ts`
4. `src/application/usecases/prepare.swap.usecase.ts`
5. `src/infrastructure/http/controllers/swap.controller.ts`

---

## 📊 FASE 4: TESTES BACKEND

### **Objetivo:** Garantir qualidade com testes unitários e de integração

### **Tasks Detalhadas:**

#### **TASK 4.1: Setup de Testes**

**Sub-tasks:**
- [ ] 4.1.1: Instalar dependências de teste:
  ```bash
  npm install --save-dev jest @types/jest ts-jest
  npm install --save-dev @types/node
  ```

- [ ] 4.1.2: Criar `jest.config.js`:
  ```javascript
  module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
      'src/**/*.ts',
      '!src/**/*.d.ts',
      '!src/**/index.ts',
    ],
    coverageThreshold: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  };
  ```

- [ ] 4.1.3: Atualizar `package.json`:
  ```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage"
    }
  }
  ```

- [ ] 4.1.4: Criar pasta `src/__tests__/`:
  ```
  src/__tests__/
  ├── unit/
  │   ├── domain/
  │   ├── application/
  │   └── infrastructure/
  └── integration/
  ```

**Validação:**
- ✅ Jest configurado
- ✅ Scripts de teste funcionando
- ✅ Estrutura de pastas criada

---

#### **TASK 4.2: Testes Unitários - Domain Layer**

**Arquivo:** `src/__tests__/unit/domain/router.domain.service.test.ts`

**Sub-tasks:**
- [ ] 4.2.1: Testar `selectBestProvider()` - same-chain routes para Uniswap:
  ```typescript
  describe('RouterDomainService', () => {
    let router: RouterDomainService;
    let mockUniswap: jest.Mocked<ISwapProvider>;
    let mockThirdweb: jest.Mocked<ISwapProvider>;

    beforeEach(() => {
      mockUniswap = {
        name: 'uniswap',
        supportsRoute: jest.fn(),
        getQuote: jest.fn(),
        prepareSwap: jest.fn(),
        monitorTransaction: jest.fn(),
      };

      mockThirdweb = {
        name: 'thirdweb',
        supportsRoute: jest.fn(),
        getQuote: jest.fn(),
        prepareSwap: jest.fn(),
        monitorTransaction: jest.fn(),
      };

      const providers = new Map([
        ['uniswap', mockUniswap],
        ['thirdweb', mockThirdweb],
      ]);

      router = new RouterDomainService(providers);
    });

    it('should select Uniswap for same-chain swap', async () => {
      const request = new SwapRequest(
        1, 1, // Ethereum -> Ethereum
        '0xA0b8...', '0xdAC1...',
        BigInt(1000000),
        '0xSender', '0xReceiver'
      );

      mockUniswap.supportsRoute.mockResolvedValue(true);
      mockUniswap.getQuote.mockResolvedValue(/* mock quote */);
      mockThirdweb.supportsRoute.mockResolvedValue(true);

      const { provider } = await router.selectBestProvider(request);

      expect(provider.name).toBe('uniswap');
      expect(mockUniswap.getQuote).toHaveBeenCalled();
      expect(mockThirdweb.getQuote).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] 4.2.2: Testar cross-chain routes para Thirdweb
- [ ] 4.2.3: Testar fallback quando provider preferido falha
- [ ] 4.2.4: Testar erro quando nenhum provider suporta rota
- [ ] 4.2.5: Testar erro quando todos providers falham

**Mais arquivos de teste:**
- [ ] 4.2.6: `src/__tests__/unit/domain/entities/swap.test.ts` - testar entidades
- [ ] 4.2.7: `src/__tests__/unit/application/provider-selector.service.test.ts`

**Validação:**
- ✅ Cobertura de testes > 70% no domain layer
- ✅ Todos os cenários principais testados
- ✅ Testes passando

---

#### **TASK 4.3: Testes Unitários - Uniswap Adapter**

**Arquivo:** `src/__tests__/unit/infrastructure/uniswap.provider.adapter.test.ts`

**Sub-tasks:**
- [ ] 4.3.1: Mock do UniswapAPIClient
- [ ] 4.3.2: Testar `supportsRoute()`:
  - ✅ Same-chain supported chains → true
  - ❌ Cross-chain → false
  - ❌ Unsupported chain → false
  - ❌ Provider disabled → false

- [ ] 4.3.3: Testar `getQuote()`:
  - ✅ Quote success → retorna SwapQuote
  - ✅ Gas fee parsing correto
  - ✅ Exchange rate calculation correto
  - ❌ API error → throw error

- [ ] 4.3.4: Testar `prepareSwap()`:
  - ✅ CLASSIC routing → retorna swap transaction
  - ✅ UniswapX routing → retorna order
  - ❌ Approval required → throw APPROVAL_REQUIRED
  - ❌ Permit2 required → throw PERMIT2_SIGNATURE_REQUIRED

- [ ] 4.3.5: Testar `monitorTransaction()`:
  - ✅ On-chain TX → retorna status
  - ✅ UniswapX order → retorna status

**Validação:**
- ✅ Cobertura > 70%
- ✅ Todos os casos de sucesso e erro testados
- ✅ Mocks corretos

---

#### **TASK 4.4: Testes de Integração**

**Arquivo:** `src/__tests__/integration/swap.flow.test.ts`

**Sub-tasks:**
- [ ] 4.4.1: Testar fluxo completo Quote → Prepare (mocked APIs):
  ```typescript
  describe('Swap Integration Flow', () => {
    it('should complete quote -> prepare flow with Uniswap', async () => {
      // 1. Get quote
      const quoteRequest = {
        fromChainId: 1,
        toChainId: 1,
        fromToken: 'USDC',
        toToken: 'WETH',
        amount: '1000',
        sender: '0xSender',
      };

      const quoteResponse = await getQuoteUseCase.execute(quoteRequest);

      expect(quoteResponse.provider).toBe('uniswap');
      expect(quoteResponse.estimatedReceiveAmount).toBeDefined();

      // 2. Prepare swap
      const prepareRequest = {
        ...quoteRequest,
        receiver: '0xReceiver',
      };

      const prepareResponse = await prepareSwapUseCase.execute(prepareRequest);

      expect(prepareResponse.provider).toBe('uniswap');
      expect(prepareResponse.transactions).toHaveLength(1);
      expect(prepareResponse.transactions[0].to).toBeDefined();
    });
  });
  ```

- [ ] 4.4.2: Testar fluxo cross-chain (deve usar Thirdweb)
- [ ] 4.4.3: Testar fallback (Uniswap fail → Thirdweb)
- [ ] 4.4.4: Testar preferredProvider

**Validação:**
- ✅ Fluxos end-to-end passando
- ✅ Integration entre camadas funcionando
- ✅ Routing correto

---

#### **TASK 4.5: Testes Manuais (API)**

**Sub-tasks:**
- [ ] 4.5.1: Criar arquivo `test-requests.http` (REST Client):
  ```http
  ### Health Check
  GET http://localhost:3002/health

  ### Get Quote - Same-chain (deve usar Uniswap)
  POST http://localhost:3002/swap/quote
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}

  {
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amount": "1000000000"
  }

  ### Get Quote - Cross-chain (deve usar Thirdweb)
  POST http://localhost:3002/swap/quote
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}

  {
    "fromChainId": 1,
    "toChainId": 137,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "1000000000"
  }

  ### Prepare Swap - Uniswap
  POST http://localhost:3002/swap/prepare
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}

  {
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amount": "1000000000",
    "sender": "0xYourAddress",
    "receiver": "0xYourAddress"
  }

  ### Prepare Swap - Force Thirdweb
  POST http://localhost:3002/swap/prepare
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}

  {
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amount": "1000000000",
    "sender": "0xYourAddress",
    "receiver": "0xYourAddress",
    "preferredProvider": "thirdweb"
  }
  ```

- [ ] 4.5.2: Testar cada endpoint:
  - ✅ Health check
  - ✅ Quote same-chain (verifica provider: 'uniswap')
  - ✅ Quote cross-chain (verifica provider: 'thirdweb')
  - ✅ Prepare same-chain
  - ✅ Prepare com preferredProvider
  - ❌ Token não suportado
  - ❌ Chain não suportada
  - ❌ Sem autenticação

- [ ] 4.5.3: Validar responses:
  - ✅ Status codes corretos (200, 400, 401, 502)
  - ✅ Response schema correto
  - ✅ Provider info presente em metadata
  - ✅ Transactions válidas (to, data, value, chainId)

- [ ] 4.5.4: Validar logs do servidor:
  - ✅ Provider selection logs
  - ✅ Routing logs
  - ✅ Error logs detalhados

**Validação:**
- ✅ Todos os endpoints respondem
- ✅ Routing funciona corretamente
- ✅ Error handling apropriado
- ✅ Logs informativos

---

### **Checkpoints da FASE 4:**

**Antes de prosseguir para FASE 5, validar:**
- ✅ Jest configurado e funcionando
- ✅ Testes unitários passando (coverage > 70%)
- ✅ Testes de integração passando
- ✅ Testes manuais validados
- ✅ Nenhuma regressão (funcionalidade antiga funciona)
- ✅ Git commit: `test(swap): add comprehensive test suite`

**Arquivos criados:**
1. `jest.config.js`
2. `src/__tests__/unit/**/*.test.ts`
3. `src/__tests__/integration/**/*.test.ts`
4. `test-requests.http`

**Comandos de validação:**
```bash
npm test                  # Todos os testes
npm run test:coverage     # Cobertura
npm run dev              # Start server
# Testar endpoints manualmente
```

---

## 📊 FASE 5: FRONTEND/MINIAPP INTEGRATION

### **Objetivo:** Atualizar frontend Telegram MiniApp para suportar multi-provider

### **Tasks Detalhadas:**

#### **TASK 5.1: Analisar Frontend Existente**

**Sub-tasks:**
- [ ] 5.1.1: Localizar código do MiniApp:
  ```bash
  find /home/hugo/dev/projects/panoramablock/01/telegram -name "*.tsx" -o -name "*.ts" | grep -i swap
  ```

- [ ] 5.1.2: Identificar componentes de swap:
  - SwapForm / SwapInterface
  - API client / hooks
  - Transaction handling

- [ ] 5.1.3: Identificar como quote/prepare são chamados:
  - fetch() direto?
  - Axios?
  - Thirdweb SDK?

- [ ] 5.1.4: Documentar fluxo atual:
  ```
  User Input → Get Quote → Show Quote → Confirm → Prepare → Sign TX → Send
  ```

**Validação:**
- ✅ Frontend code localizado
- ✅ Fluxo atual entendido
- ✅ API integration points identificados

---

#### **TASK 5.2: Atualizar API Types**

**Arquivo:** `telegram/apps/miniapp/src/types/api.ts` (ou similar)

**Sub-tasks:**
- [ ] 5.2.1: Atualizar QuoteResponse type:
  ```typescript
  export interface SwapQuoteResponse {
    success: boolean;
    quote: {
      estimatedReceiveAmount: string;
      bridgeFee: string;
      gasFee: string;
      exchangeRate: number;
      estimatedDuration: number;
      // ... existing fields
    };
    metadata: {
      provider: 'uniswap' | 'thirdweb'; // NEW
      routingStrategy: string;
      timestamp: string;
    };
  }
  ```

- [ ] 5.2.2: Atualizar PrepareResponse type:
  ```typescript
  export interface SwapPrepareResponse {
    success: boolean;
    transactions: Array<{
      chainId: number;
      to: string;
      data: string;
      value: string;
      gasLimit?: string;
    }>;
    estimatedDuration: number;
    expiresAt?: string;
    provider: 'uniswap' | 'thirdweb'; // NEW
    metadata?: Record<string, any>; // NEW
  }
  ```

- [ ] 5.2.3: Criar type para Permit2 error:
  ```typescript
  export interface Permit2ErrorResponse {
    success: false;
    error: 'PERMIT2_SIGNATURE_REQUIRED';
    message: string;
    permitData: {
      domain: any;
      types: any;
      values: any;
    };
  }
  ```

**Validação:**
- ✅ Types atualizados
- ✅ Compilação TypeScript OK

---

#### **TASK 5.3: Atualizar API Client**

**Arquivo:** `telegram/apps/miniapp/src/api/swap.api.ts` (ou similar)

**Sub-tasks:**
- [ ] 5.3.1: Atualizar função `getQuote()`:
  ```typescript
  export async function getSwapQuote(params: {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string;
  }): Promise<SwapQuoteResponse> {
    const response = await fetch(`${API_URL}/swap/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Quote failed: ${response.statusText}`);
    }

    const data: SwapQuoteResponse = await response.json();

    // Log provider usado
    console.log('[SwapAPI] Quote provider:', data.metadata.provider);

    return data;
  }
  ```

- [ ] 5.3.2: Atualizar função `prepareSwap()`:
  ```typescript
  export async function prepareSwap(params: {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string;
    sender: string;
    receiver: string;
    preferredProvider?: 'uniswap' | 'thirdweb'; // NEW: optional
  }): Promise<SwapPrepareResponse | Permit2ErrorResponse> {
    const response = await fetch(`${API_URL}/swap/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    // Handle Permit2 error
    if (data.error === 'PERMIT2_SIGNATURE_REQUIRED') {
      return data as Permit2ErrorResponse;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Prepare failed');
    }

    console.log('[SwapAPI] Prepare provider:', data.provider);

    return data as SwapPrepareResponse;
  }
  ```

**Validação:**
- ✅ API client atualizado
- ✅ Error handling para Permit2
- ✅ Logging de provider

---

#### **TASK 5.4: Criar UI para Provider Selection (opcional)**

**Arquivo:** `telegram/apps/miniapp/src/components/SwapProviderSelector.tsx`

**Sub-tasks:**
- [ ] 5.4.1: Criar componente (se quiser dar escolha ao usuário):
  ```typescript
  import { useState } from 'react';

  export function SwapProviderSelector({
    onProviderChange
  }: {
    onProviderChange: (provider: 'auto' | 'uniswap' | 'thirdweb') => void;
  }) {
    const [selected, setSelected] = useState<'auto' | 'uniswap' | 'thirdweb'>('auto');

    const handleChange = (provider: typeof selected) => {
      setSelected(provider);
      onProviderChange(provider);
    };

    return (
      <div className="provider-selector">
        <label>Swap Provider:</label>
        <select value={selected} onChange={(e) => handleChange(e.target.value as any)}>
          <option value="auto">Auto (Recommended)</option>
          <option value="uniswap">Uniswap (Same-chain only)</option>
          <option value="thirdweb">Thirdweb (Cross-chain)</option>
        </select>
      </div>
    );
  }
  ```

- [ ] 5.4.2: Integrar no SwapForm (opcional - pode deixar sempre auto)

**Validação:**
- ✅ Componente funciona
- ✅ State management OK

---

#### **TASK 5.5: Atualizar Swap Flow - Handle Permit2**

**Arquivo:** `telegram/apps/miniapp/src/hooks/useSwapFlow.ts` (ou similar)

**Sub-tasks:**
- [ ] 5.5.1: Adicionar handling de Permit2:
  ```typescript
  export function useSwapFlow() {
    const [step, setStep] = useState<'quote' | 'prepare' | 'permit' | 'sign' | 'confirm'>('quote');
    const [permitData, setPermitData] = useState<any>(null);

    async function handlePrepareSwap() {
      setStep('prepare');

      const result = await prepareSwap({
        // ... params
      });

      // Check if Permit2 signature needed
      if ('error' in result && result.error === 'PERMIT2_SIGNATURE_REQUIRED') {
        console.log('[SwapFlow] Permit2 signature required');
        setPermitData(result.permitData);
        setStep('permit');
        return;
      }

      // Normal flow
      setStep('sign');
      // ... continue with signing
    }

    async function handleSignPermit2() {
      if (!permitData) return;

      // Use ethers or viem to sign EIP-712 message
      const signature = await signTypedData({
        domain: permitData.domain,
        types: permitData.types,
        value: permitData.values,
      });

      console.log('[SwapFlow] Permit2 signed:', signature);

      // Now prepare swap again WITH permit signature
      const result = await prepareSwap({
        // ... params
        permitSignature: signature, // Include signature
      });

      setStep('sign');
      // ... continue
    }

    return {
      step,
      permitData,
      handlePrepareSwap,
      handleSignPermit2,
      // ...
    };
  }
  ```

- [ ] 5.5.2: Atualizar UI para mostrar Permit2 step:
  ```typescript
  {step === 'permit' && (
    <div className="permit-step">
      <h3>Approval Required</h3>
      <p>Sign a gasless approval message to allow the swap</p>
      <button onClick={handleSignPermit2}>
        Sign Approval
      </button>
    </div>
  )}
  ```

**Validação:**
- ✅ Permit2 flow funciona
- ✅ UI atualizada
- ✅ Assinatura EIP-712 funcionando

---

#### **TASK 5.6: Adicionar Provider Badge na UI**

**Arquivo:** `telegram/apps/miniapp/src/components/SwapQuoteDisplay.tsx`

**Sub-tasks:**
- [ ] 5.6.1: Mostrar provider usado:
  ```typescript
  export function SwapQuoteDisplay({ quote }: { quote: SwapQuoteResponse }) {
    const providerBadge = {
      uniswap: { icon: '🦄', label: 'Uniswap', color: '#FF007A' },
      thirdweb: { icon: '⚡', label: 'Thirdweb', color: '#7C3AED' },
    }[quote.metadata.provider];

    return (
      <div className="quote-display">
        {/* Provider Badge */}
        <div className="provider-badge" style={{ backgroundColor: providerBadge.color }}>
          <span>{providerBadge.icon}</span>
          <span>{providerBadge.label}</span>
        </div>

        {/* Quote Details */}
        <div className="quote-amount">
          {quote.quote.estimatedReceiveAmount}
        </div>

        {/* ... rest */}
      </div>
    );
  }
  ```

**Validação:**
- ✅ Badge visível
- ✅ Cores/ícones corretos

---

### **Checkpoints da FASE 5:**

**Antes de prosseguir para FASE 6, validar:**
- ✅ Types atualizados
- ✅ API client funcionando
- ✅ Permit2 flow implementado
- ✅ UI atualizada (provider badge)
- ✅ Compilação OK
- ✅ Git commit: `feat(frontend): support multi-provider swap`

**Arquivos modificados:**
1. `telegram/apps/miniapp/src/types/api.ts`
2. `telegram/apps/miniapp/src/api/swap.api.ts`
3. `telegram/apps/miniapp/src/hooks/useSwapFlow.ts`
4. `telegram/apps/miniapp/src/components/SwapQuoteDisplay.tsx`
5. (Opcional) `telegram/apps/miniapp/src/components/SwapProviderSelector.tsx`

---

## 📊 FASE 6: E2E TESTING

### **Objetivo:** Validar tudo funcionando end-to-end em testnet e mainnet

### **Tasks Detalhadas:**

#### **TASK 6.1: Testes em Testnet**

**Sub-tasks:**
- [ ] 6.1.1: Configurar `.env` para testnet:
  ```bash
  UNISWAP_ENABLED=true
  UNISWAP_API_KEY=your_key
  # Use testnet RPC URLs
  ```

- [ ] 6.1.2: Obter tokens de testnet (Sepolia):
  - ETH via faucet
  - USDC via Aave faucet
  - WETH via wrap

- [ ] 6.1.3: Testar fluxo completo via Telegram MiniApp:
  **Cenário 1: Uniswap Same-Chain**
  - [ ] Quote: Sepolia USDC → WETH
  - [ ] Verificar provider: 'uniswap'
  - [ ] Prepare swap
  - [ ] (Se Permit2) Assinar approval
  - [ ] Assinar transaction
  - [ ] Enviar transaction
  - [ ] Monitorar confirmação
  - [ ] Verificar tokens recebidos

  **Cenário 2: Thirdweb Cross-Chain**
  - [ ] Quote: Sepolia USDC → Mumbai USDC
  - [ ] Verificar provider: 'thirdweb'
  - [ ] Prepare swap
  - [ ] Assinar transaction(s)
  - [ ] Enviar
  - [ ] Monitorar bridge
  - [ ] Verificar tokens na chain destino

- [ ] 6.1.4: Testar error cases:
  - [ ] Token não suportado
  - [ ] Saldo insuficiente
  - [ ] Slippage exceeded
  - [ ] Transaction reverted

- [ ] 6.1.5: Validar logs:
  - ✅ Provider selection correto
  - ✅ Routing logs informativos
  - ✅ Error messages claros

**Validação:**
- ✅ Swaps completados com sucesso em testnet
- ✅ Ambos providers (Uniswap e Thirdweb) funcionam
- ✅ Error handling apropriado
- ✅ UX aceitável

---

#### **TASK 6.2: Performance Testing**

**Sub-tasks:**
- [ ] 6.2.1: Medir tempo de resposta:
  - Quote: < 2s
  - Prepare: < 3s

- [ ] 6.2.2: Testar rate limiting:
  - Fazer 20 requests em 1 segundo
  - Verificar se 419 (rate limit) é handled

- [ ] 6.2.3: Testar retry logic:
  - Simular falha temporária
  - Verificar se retry funciona

**Validação:**
- ✅ Performance aceitável
- ✅ Rate limiting handled
- ✅ Retry funciona

---

#### **TASK 6.3: Security Review**

**Sub-tasks:**
- [ ] 6.3.1: Verificar API key não exposta:
  ```bash
  grep -r "UNISWAP_API_KEY" --exclude-dir=node_modules
  # Deve aparecer só em .env e código servidor
  ```

- [ ] 6.3.2: Verificar auth middleware em todos endpoints

- [ ] 6.3.3: Verificar input validation:
  - chainId positivo
  - amount > 0
  - addresses válidos

- [ ] 6.3.4: Verificar error messages não vazam info sensível

**Validação:**
- ✅ API key segura
- ✅ Todos endpoints autenticados
- ✅ Input validation robusto
- ✅ Error messages seguros

---

#### **TASK 6.4: Mainnet Smoke Tests (CUIDADO)**

**Sub-tasks:**
- [ ] 6.4.1: Configurar `.env` para mainnet:
  ```bash
  UNISWAP_ENABLED=true
  UNISWAP_API_KEY=production_key
  # Mainnet RPC URLs
  ```

- [ ] 6.4.2: Testar com valores PEQUENOS (< $5):
  - [ ] Quote mainnet (Ethereum USDC → ETH)
  - [ ] Verificar provider e quote razoável
  - [ ] **NÃO executar ainda** (só preparar)

- [ ] 6.4.3: Code review final antes de mainnet deploy

- [ ] 6.4.4: (Opcional) Deploy canary: 10% de tráfego para novo código

**Validação:**
- ✅ Mainnet config OK
- ✅ Quotes razoáveis (comparar com Uniswap UI)
- ✅ Code review aprovado
- ✅ Monitoring configurado

---

### **Checkpoints da FASE 6:**

**Antes de deploy final, validar:**
- ✅ Testes em testnet passaram
- ✅ Performance aceitável
- ✅ Security review OK
- ✅ Mainnet quotes fazem sentido
- ✅ Monitoring/alerting configurado
- ✅ Rollback plan definido
- ✅ Git tag: `v1.0.0-uniswap-integration`

---

## 📊 DOCUMENTAÇÃO FINAL

### **TASK 7.1: Atualizar README**

**Arquivo:** `README.md`

**Adicionar seção:**
```markdown
## 🔄 Swap Routing

O sistema usa **roteamento inteligente** entre providers:

- **Same-chain swaps** → Uniswap Trading API (V2/V3/V4/UniswapX)
- **Cross-chain swaps** → Thirdweb Bridge
- **Fallback automático** se provider preferido falhar

### Supported Providers

#### Uniswap
- **Chains**: Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche, etc.
- **Features**: V2/V3/V4 routing, UniswapX gasless swaps
- **Limitations**: Same-chain only

#### Thirdweb
- **Chains**: 50+ chains
- **Features**: Cross-chain bridges, gasful swaps
- **Limitations**: Higher fees for bridges

### Configuration

```bash
# .env
UNISWAP_ENABLED=true
UNISWAP_API_KEY=your_api_key
```

### API Examples

**Get Quote (auto-routing):**
```bash
curl -X POST http://localhost:3002/swap/quote \
  -H "Authorization: Bearer $JWT" \
  -d '{"fromChainId": 1, "toChainId": 1, "fromToken": "USDC", "toToken": "ETH", "amount": "100"}'
```

**Response:**
```json
{
  "success": true,
  "quote": { ... },
  "metadata": {
    "provider": "uniswap",
    "routingStrategy": "auto"
  }
}
```
```

**Validação:**
- ✅ README atualizado
- ✅ Exemplos funcionando
- ✅ Configuração documentada

---

### **TASK 7.2: Criar Diagrama de Arquitetura**

**Arquivo:** `docs/architecture/swap-routing.md`

**Conteúdo:**
```markdown
# Swap Routing Architecture

## Flow Diagram

```
User Request
    ↓
SwapController
    ↓
GetQuoteUseCase / PrepareSwapUseCase
    ↓
ProviderSelectorService
    ↓
RouterDomainService
    ↓
    ├─ Same-chain? → UniswapProviderAdapter → Uniswap API
    └─ Cross-chain? → ThirdwebProviderAdapter → Thirdweb Bridge
```

## Components

### Domain Layer
- `ISwapProvider` - Interface genérica para providers
- `RouterDomainService` - Lógica de seleção de provider
- `SwapRequest`, `SwapQuote` - Entidades de domínio

### Application Layer
- `ProviderSelectorService` - Orquestra seleção
- `GetQuoteUseCase` - Caso de uso de cotação
- `PrepareSwapUseCase` - Caso de uso de preparação

### Infrastructure Layer
- `UniswapProviderAdapter` - Integração Uniswap API
- `ThirdwebProviderAdapter` - Integração Thirdweb
- `DIContainer` - Injeção de dependências

## Decision Logic

```typescript
if (same-chain && uniswap-supports-chain) {
  try {
    return Uniswap
  } catch {
    return Thirdweb (fallback)
  }
} else {
  return Thirdweb
}
```
```

**Validação:**
- ✅ Diagrama claro
- ✅ Decision logic documentada

---

## 🎯 RESUMO EXECUTIVO

### **Total de Tasks: ~120 tasks**

**Distribuição por fase:**
- FASE 1 (Domain & Ports): 20 tasks - **5-7 dias**
- FASE 2 (Uniswap Adapter): 35 tasks - **7-10 dias**
- FASE 3 (Integration): 25 tasks - **5-7 dias**
- FASE 4 (Backend Tests): 20 tasks - **3-5 dias**
- FASE 5 (Frontend): 15 tasks - **5-7 dias**
- FASE 6 (E2E Testing): 10 tasks - **3-4 dias**
- Documentação: 5 tasks - **1-2 dias**

**Timeline Total: ~30-40 dias de trabalho**

### **Prioridades Absolutas (P0):**
1. ✅ FASE 1 (arquitetura genérica)
2. ✅ FASE 2 (Uniswap adapter)
3. ✅ FASE 3 (integration)
4. ✅ FASE 4.1-4.4 (testes básicos)

### **Nice-to-have (P1):**
- FASE 4.5 (testes manuais extensivos)
- FASE 5.4 (UI provider selector)
- FASE 6.4 (mainnet canary deploy)

### **Pode deixar pra depois (P2):**
- Documentação completa de arquitetura
- Diagramas fancy
- Coverage > 90%

---

## ✅ PRÓXIMOS PASSOS IMEDIATOS

**O que fazer AGORA:**

1. **Revisar este roadmap** - qualquer dúvida/ajuste?
2. **Confirmar API key Uniswap** - já tem? Funciona?
3. **Definir prioridade** - começar por QUAL task?

**Recomendação:** Começar por **FASE 1 - TASK 1.1** (criar ISwapProvider port)

**Queremos:**
- Ir task por task juntos?
- Eu implementar um bloco e você revisar?
- Pair programming real-time?

**Me diga como prefere trabalhar e começamos! 🚀**
