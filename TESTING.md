# Guia de Testes para Microsserviços PanoramaBlock

Este documento fornece instruções passo a passo para testar os microsserviços do PanoramaBlock.

## Pré-requisitos

1. Docker e Docker Compose instalados
2. Arquivo `.env` criado com base no `.env.example`
3. Credenciais necessárias preenchidas no arquivo `.env`

## Iniciar os Serviços

```bash
# Construir e iniciar todos os serviços
docker-compose up -d

# Verificar se todos os serviços estão rodando
docker-compose ps
```

## 1. Testar o Auth Service

### 1.1. Verificar saúde do serviço

```bash
curl http://localhost:3001/health
```

Resposta esperada:
```json
{"status":"ok","service":"auth-service"}
```

### 1.2. Testar login (gerar payload)

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0xYOUR_WALLET_ADDRESS"}'
```

Resposta esperada (o conteúdo variará):
```json
{
  "payload": {
    "type": "evm",
    "domain": "panoramablock.com",
    "address": "0xYOUR_WALLET_ADDRESS",
    "statement": "Login to Panorama Block",
    "version": "1",
    "chainId": "1",
    "nonce": "random-string",
    "issuedAt": "2024-...",
    "expirationTime": "2024-..."
  }
}
```

### 1.3. Testar verificação (simulando assinatura)

Para testes, use a rota de teste que não valida a assinatura:

```bash
curl -X POST http://localhost:3001/auth/test/verify \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "type": "evm",
      "domain": "panoramablock.com",
      "address": "0xYOUR_WALLET_ADDRESS",
      "statement": "Login to Panorama Block",
      "version": "1",
      "chainId": "1"
    },
    "signature": "mock-signature"
  }'
```

Resposta esperada:
```json
{
  "token": "mock_jwt_token_...",
  "address": "0xYOUR_WALLET_ADDRESS"
}
```

**Importante:** Guarde o token retornado para usar nos testes dos outros serviços.

## 2. Testar o Wallet Tracker Service

### 2.1. Verificar saúde do serviço

```bash
curl http://localhost:3002/health
```

Resposta esperada:
```json
{"status":"ok","service":"wallet-tracker-service"}
```

### 2.2. Testar rastreamento de carteira (requer autenticação)

Substitua `YOUR_JWT_TOKEN` pelo token obtido no passo 1.3.

```bash
curl -X POST http://localhost:3002/wallets/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "address": "0xYOUR_WALLET_ADDRESS",
    "networks": [1, 137]
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "message": "Wallet tracking initiated",
  "trackingId": "some-id"
}
```

## 3. Testar o Liquid Swap Service

### 3.1. Verificar saúde do serviço

```bash
curl http://localhost:3003/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "liquid-swap-service",
  "version": "1.0.0",
  "supportedChains": [1, 137, 56, 8453, 10, 42161]
}
```

### 3.2. Obter cotação de swap (requer autenticação)

Substitua `YOUR_JWT_TOKEN` pelo token obtido no passo 1.3.

```bash
curl -X POST http://localhost:3003/swap/manual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fromChainId": 1,
    "toChainId": 137,
    "fromToken": "NATIVE",
    "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "1000000000000000"
  }'
```

**Nota:** Para executar um swap real, você precisará configurar as variáveis de ambiente `PRIVATE_KEY`, `SWAP_SENDER_ADDRESS` e `SWAP_RECEIVER_ADDRESS` com valores válidos. O exemplo acima provavelmente falhará sem essas configurações, mas servirá para verificar se o serviço está funcionando e autenticando corretamente.

## 4. Verificar Integração entre Serviços

### 4.1. Fluxo Completo

1. Fazer login no Auth Service para obter um token JWT
2. Usar esse token para acessar o Wallet Tracker Service e rastrear uma carteira
3. Usar o mesmo token para acessar o Liquid Swap Service e solicitar um swap

Se todos os passos funcionarem, a integração entre os serviços está correta.

## 5. Solução de Problemas

### 5.1. Verificar logs dos serviços

```bash
# Ver logs de um serviço específico
docker-compose logs auth_service
docker-compose logs wallet_tracker_service
docker-compose logs liquid_swap_service

# Ver logs em tempo real
docker-compose logs -f auth_service
```

### 5.2. Problemas comuns

- **Erro de conexão recusada:** Verifique se o serviço está rodando (`docker-compose ps`)
- **Erro de autenticação:** Verifique se o token JWT é válido e não expirou
- **Erro no Redis:** Verifique se o Redis está rodando e acessível
- **Erro no MongoDB:** Verifique se o MongoDB está rodando e acessível

## 6. Parar os Serviços

```bash
# Parar todos os serviços
docker-compose down

# Parar e remover volumes (isso apagará os dados)
docker-compose down -v
``` 