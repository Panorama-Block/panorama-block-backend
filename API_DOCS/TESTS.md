# 🧪 Testes do Panorama Block Backend

Este documento explica como executar todos os testes do sistema.

## 📁 Estrutura dos Testes

```
panorama-block-backend/
├── api_backend/tests/          # Testes do backend
│   ├── test.js                # Teste principal do backend
│   ├── test-core-js.js        # Teste core JavaScript
│   ├── run-tests.sh          # Script para executar testes do backend
│   └── README.md              # Documentação dos testes do backend
├── api_frontend/tests/         # Testes do frontend
│   ├── test-frontend.js       # Teste principal do frontend
│   ├── test-swap-routes.js    # Testes de rotas de swap
│   ├── test-validation-lending.js # Testes de rotas de lending
│   ├── run-tests.sh          # Script para executar testes do frontend
│   └── README.md              # Documentação dos testes do frontend
└── run-all-tests.sh           # Script para executar todos os testes
```

## 🚀 Como Executar

### Opção 1: Executar Todos os Testes
```bash
# Executa todos os testes (backend + frontend)
./run-all-tests.sh
```

### Opção 2: Executar Testes Específicos

#### Backend API
```bash
cd api_backend/tests
./run-tests.sh
```

#### Frontend API
```bash
cd api_frontend/tests
./run-tests.sh
```

### Opção 3: Executar Testes Individuais

#### Backend
```bash
cd api_backend
node tests/test.js
node tests/test-core-js.js
```

#### Frontend
```bash
cd api_frontend
node tests/test-frontend.js
node tests/test-swap-routes.js
node tests/test-validation-lending.js
```

## 📋 Tipos de Testes

### 🔧 Backend API (`api_backend/tests/`)
- **`test.js`**: Teste principal que verifica:
  - ✅ Health check da API
  - ✅ Rotas básicas (Trader Joe, Benqi, Validation)
  - ✅ Autenticação e middleware
  - ✅ Integração com contratos

- **`test-core-js.js`**: Teste básico do core JavaScript

### 🎨 Frontend API (`api_frontend/tests/`)
- **`test-frontend.js`**: Teste principal que verifica:
  - ✅ Endpoints públicos (tokens, qTokens, status)
  - ✅ Health check da API
  - ✅ Integração com backend

- **`test-swap-routes.js`**: Testes específicos para rotas de swap:
  - ✅ Listagem de tokens
  - ✅ Rotas de validação + swap
  - ✅ Preparação de transações

- **`test-validation-lending.js`**: Testes específicos para rotas de lending:
  - ✅ Listagem de qTokens
  - ✅ Rotas de validação + lending
  - ✅ Preparação de transações

## 🔧 Pré-requisitos

### Configuração de Ambiente
1. **Backend API** rodando na porta 3001
2. **Frontend API** rodando na porta 3002
3. **Variáveis de ambiente** configuradas (`.env`)

### Arquivo `.env` Necessário
```env
PRIVATE_KEY=sua_private_key_aqui
RPC_URL=https://api.avax.network/ext/bc/C/rpc
VALIDATION_CONTRACT_ADDRESS=endereco_do_contrato
BACKEND_URL=http://localhost:3001
```

### Dependências
- Node.js instalado
- Contratos deployados na rede Avalanche (para testes de validação)
- Fundos na wallet (para alguns testes)

## 📊 Resultados Esperados

### ✅ Backend API
- Todas as rotas respondem corretamente
- Autenticação funciona
- Integração com contratos funciona
- Middleware de rate limiting funciona
- Validação de entrada funciona

### ✅ Frontend API
- Endpoints públicos respondem
- Integração com backend funciona
- Health check funciona
- Rotas de validação preparam transações
- Autenticação funciona (com private key)

## 🐛 Troubleshooting

### Backend não está rodando
```bash
cd api_backend
node index.js
```

### Frontend não está rodando
```bash
cd api_frontend
node index.js
```

### Erro de conexão
- Verifique se as portas 3001 e 3002 estão livres
- Verifique se as variáveis de ambiente estão configuradas
- Verifique se o RPC da Avalanche está acessível

### Erro de autenticação
- Verifique se a `PRIVATE_KEY` está configurada
- Verifique se a wallet tem fundos suficientes
- Verifique se os contratos estão deployados

## 📝 Notas Importantes

- Os testes de autenticação requerem `PRIVATE_KEY` no `.env`
- Alguns testes podem falhar se as APIs não estiverem rodando
- Os testes de validação requerem o backend com contratos deployados
- Os testes do frontend focam em preparação de transações, não execução direta
- Os scripts `run-tests.sh` podem iniciar as APIs automaticamente se necessário
