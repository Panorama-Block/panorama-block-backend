# 🧪 Testes do Frontend API

Esta pasta contém todos os testes para o `api_frontend`.

## 📋 Arquivos de Teste

### `test-frontend.js`
Teste principal do frontend que verifica:
- ✅ Endpoints públicos (tokens, qTokens, status)
- ✅ Health check da API
- ✅ Integração com backend

### `test-swap-routes.js`
Testes específicos para rotas de swap:
- ✅ Listagem de tokens
- ✅ Rotas de validação + swap
- ✅ Preparação de transações

### `test-validation-lending.js`
Testes específicos para rotas de lending:
- ✅ Listagem de qTokens
- ✅ Rotas de validação + lending
- ✅ Preparação de transações

## 🚀 Como Executar

### Pré-requisitos
1. Backend API rodando na porta 3001
2. Frontend API rodando na porta 3002
3. Variáveis de ambiente configuradas (`.env`)

### Executar Testes

```bash
# Navegar para a pasta do frontend
cd api_frontend

# Executar teste principal
node tests/test-frontend.js

# Executar testes de swap
node tests/test-swap-routes.js

# Executar testes de lending
node tests/test-validation-lending.js
```

### Executar com APIs Rodando

```bash
# Terminal 1: Iniciar backend
cd api_backend
node index.js

# Terminal 2: Iniciar frontend
cd api_frontend
node index.js

# Terminal 3: Executar testes
cd api_frontend
node tests/test-frontend.js
```

## 📊 Resultados Esperados

### `test-frontend.js`
- ✅ Endpoints públicos respondem
- ✅ Integração com backend funciona
- ✅ Health check funciona

### `test-swap-routes.js`
- ✅ Listagem de tokens funciona
- ✅ Rotas de validação + swap preparam transações
- ✅ Autenticação funciona (com private key)

### `test-validation-lending.js`
- ✅ Listagem de qTokens funciona
- ✅ Rotas de validação + lending preparam transações
- ✅ Autenticação funciona (com private key)

## 🔧 Configuração

Certifique-se de que o arquivo `.env` contém:

```env
PRIVATE_KEY=sua_private_key_aqui
RPC_URL=https://api.avax.network/ext/bc/C/rpc
BACKEND_URL=http://localhost:3001
```

## 📝 Notas

- Os testes de autenticação requerem `PRIVATE_KEY` no `.env`
- Alguns testes podem falhar se as APIs não estiverem rodando
- Os testes de validação requerem o backend com contratos deployados
- Os testes focam em preparação de transações, não execução direta
