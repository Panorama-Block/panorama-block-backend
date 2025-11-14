# 🚀 Lido Service - Quick Start Guide

## Subir todos os serviços

```bash
# Build e start de todos os serviços (incluindo lido-service)
docker-compose up --build

# Ou em background
docker-compose up --build -d
```

**Serviços que sobem automaticamente:**
- ✅ Redis (Port 6380)
- ✅ PostgreSQL (Port 5433)
- ✅ ThirdWeb Engine (Port 3005)
- ✅ Auth Service (Port 3001)
- ✅ Liquid Swap Service (Port 3002)
- ✅ **Lido Service (Port 3004)** 🆕

---

## 🔐 Autenticação (3 passos simples)

### 1️⃣ Obter payload SIWE

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0xSuaCarteiraAqui"}'
```

### 2️⃣ Assinar payload com sua wallet

Use MetaMask, WalletConnect, ou qualquer provider Web3:

```javascript
// Frontend (React/Next.js)
const signature = await signer.signMessage(payloadString);
```

### 3️⃣ Verificar assinatura e obter JWT

```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {...},
    "signature": "0xSuaAssinaturaAqui"
  }'
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "address": "0xSuaCarteiraAqui",
  "sessionId": "..."
}
```

---

## 💎 Usar Lido Service

### Stake ETH

```bash
export JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3004/api/lido/stake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "userAddress": "0xSuaCarteiraAqui",
    "amount": "1000000000000000000"
  }'
```

### Ver posição de staking

```bash
curl -X GET http://localhost:3004/api/lido/position/0xSuaCarteiraAqui \
  -H "Authorization: Bearer $JWT"
```

### Ver informações do protocolo Lido (público)

```bash
curl -X GET http://localhost:3004/api/lido/protocol/info
```

---

## 🛠️ Comandos úteis

```bash
# Ver logs do Lido Service
docker-compose logs -f lido_service

# Ver logs de todos os serviços
docker-compose logs -f

# Parar todos os serviços
docker-compose down

# Rebuild apenas o Lido Service
docker-compose up --build lido_service

# Verificar status dos containers
docker-compose ps

# Health check do Lido Service
curl http://localhost:3004/health
```

---

## 🎯 Endpoints principais

| Endpoint | Auth | Descrição |
|----------|------|-----------|
| `POST /api/lido/stake` | ✅ JWT | Stake ETH |
| `POST /api/lido/unstake` | ✅ JWT | Unstake stETH |
| `GET /api/lido/position/:address` | ⚠️ Opcional | Ver posição |
| `GET /api/lido/protocol/info` | ❌ Público | Info do protocolo |
| `GET /health` | ❌ Público | Health check |

---

## 📊 Fluxo completo (exemplo)

```bash
# 1. Autenticar
RESPONSE=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}')

echo $RESPONSE

# 2. [Assinar payload com wallet no frontend]

# 3. Verificar e obter JWT
JWT=$(curl -s -X POST http://localhost:3001/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {...},
    "signature": "0x..."
  }' | jq -r '.token')

# 4. Fazer stake de 0.1 ETH
curl -X POST http://localhost:3004/api/lido/stake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "100000000000000000"
  }'

# 5. Verificar posição
curl -X GET http://localhost:3004/api/lido/position/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  -H "Authorization: Bearer $JWT"
```

---

## ✅ Tudo funciona igual ao Liquid Swap!

O Lido Service usa **exatamente o mesmo fluxo de autenticação** do Liquid Swap Service:

- ✅ Mesmo JWT
- ✅ Mesma validação via auth-service
- ✅ Mesma sessão no Redis
- ✅ Mesmo refresh token (14 dias)

**Uma autenticação, múltiplos serviços!** 🚀

---

**Para mais detalhes:** Veja `LIDO_SERVICE_INTEGRATION.md`
