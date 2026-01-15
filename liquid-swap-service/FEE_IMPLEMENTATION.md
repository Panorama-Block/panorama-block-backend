# Implementação de Protocol Fee - Uniswap Universal Router

## O que foi feito

Criamos um novo adapter que usa o **Uniswap Universal Router SDK** para coletar fees automaticamente em swaps same-chain.

**Atualização:** Agora usando corretamente o `SwapRouter.swapCallParameters()` com opções de fee.

---

## Arquivos Criados/Modificados

### Novo arquivo:
- `src/infrastructure/adapters/uniswap.universalrouter.adapter.ts`

### Arquivos modificados:
- `src/infrastructure/di/container.ts` - Registrado o novo adapter
- `src/domain/services/router.domain.service.ts` - Adicionado como prioridade 0

---

## Configuração (.env)

```env
# Wallet que recebe as fees dos swaps
PROTOCOL_FEE_RECIPIENT=0x11a26a13a0f7dD675870D4109ba2D7d0070C25DC

# Fee em basis points (50 = 0.5%, 100 = 1%)
PROTOCOL_FEE_BIPS=50
```

---

## Como funciona

1. Usuário solicita swap (ex: ETH → USDC)
2. `RouterDomainService` seleciona `uniswap-universal-router` como provider (prioridade 0)
3. AlphaRouter encontra a melhor rota
4. **`SwapRouter.swapCallParameters()`** gera calldata com fee embutido via comando `PAY_PORTION`
5. Usuário assina **UMA** transação
6. Swap executa + fee vai automaticamente para a wallet configurada

### Detalhes técnicos da coleta de fee:

```typescript
// Opções de fee passadas ao SwapRouter.swapCallParameters()
const swapOptions = {
  slippageTolerance,
  deadlineOrPreviousBlockhash,
  recipient: sender,
  fee: {
    fee: new Percent(feeConfig.bips, 10_000),  // ex: 50 bips = 0.5%
    recipient: feeConfig.recipient,             // endereço da wallet de fee
  }
};

// Gera calldata com comando PAY_PORTION incluído
const { calldata, value } = SwapRouter.swapCallParameters(trade, swapOptions);
```

O SDK adiciona automaticamente o comando `PAY_PORTION` (opcode 0x06) no calldata que:
- Calcula a porcentagem do output
- Envia para a wallet de fee
- Envia o restante para o usuário

---

## Prioridade dos Providers (same-chain)

```
0. uniswap-universal-router  ← NOVO (com fee nativo)
1. uniswap-trading-api
2. uniswap-smart-router
3. thirdweb
```

---

## Response do Quote/Prepare

O metadata agora inclui informações da fee:

```json
{
  "provider": "uniswap-universal-router",
  "metadata": {
    "grossAmount": "1000000000",
    "feeAmount": "5000000",
    "feeRecipient": "0x11a26a13a0f7dD675870D4109ba2D7d0070C25DC",
    "feeBips": 50,
    "universalRouterAddress": "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"
  }
}
```

---

## Chains Suportadas

- Ethereum (1)
- Optimism (10)
- Polygon (137)
- Base (8453)
- Arbitrum (42161)

---

## Dependências

Já estavam instaladas:
- `@uniswap/smart-order-router`
- `@uniswap/universal-router-sdk`
- `@uniswap/router-sdk`
- `@uniswap/sdk-core`

---

## Próximos Passos / TODO

1. **Testar no frontend** - Fazer um swap e verificar se a fee é coletada
2. **Verificar Prisma** - Se der erro de Prisma, rodar `npx prisma generate` no diretório database
3. **Cross-chain fees** - Thirdweb não suporta fee programático, só via dashboard
4. **Monitoramento** - Verificar na wallet se as fees estão chegando

---

## Comandos Úteis

```bash
# Build
npm run build

# Verificar se inicializa
node -e "require('dotenv').config({path:'../.env'}); require('./dist/infrastructure/di/container').DIContainer.getInstance()"

# Rodar o serviço
npm run dev
```

---

## Referências

- [Universal Router SDK](https://github.com/Uniswap/sdks/tree/main/sdks/universal-router-sdk)
- [PAY_PORTION Command](https://docs.uniswap.org/contracts/universal-router/technical-reference)
