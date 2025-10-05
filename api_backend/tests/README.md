# 🧪 Testes do Backend API

Esta pasta contém todos os testes para o `api_backend`.

## 📋 Arquivos de Teste

### `test.js`
Teste principal do backend que verifica:
- ✅ Health check da API
- ✅ Rotas básicas (Trader Joe, Benqi, Validation)
- ✅ Autenticação e middleware
- ✅ Integração com contratos

### `test-core-js.js`
Teste básico do core JavaScript.

## 🚀 Como Executar

### Pré-requisitos
1. Backend API rodando na porta 3001
2. Variáveis de ambiente configuradas (`.env`)
3. Contratos deployados na rede Avalanche

### Executar Testes

```bash
# Navegar para a pasta do backend
cd api_backend

# Executar teste principal
node tests/test.js

# Executar teste core
node tests/test-core-js.js
```

### Executar com Backend Rodando

```bash
# Terminal 1: Iniciar backend
cd api_backend
node index.js

# Terminal 2: Executar testes
cd api_backend
node tests/test.js
```

## 📊 Resultados Esperados

- ✅ Todas as rotas respondem corretamente
- ✅ Autenticação funciona
- ✅ Integração com contratos funciona
- ✅ Middleware de rate limiting funciona
- ✅ Validação de entrada funciona

## 🔧 Configuração

Certifique-se de que o arquivo `.env` contém:

```env
PRIVATE_KEY=sua_private_key_aqui
RPC_URL=https://api.avax.network/ext/bc/C/rpc
VALIDATION_CONTRACT_ADDRESS=endereco_do_contrato
```

## 📝 Notas

- Os testes podem falhar se o backend não estiver rodando
- Alguns testes requerem fundos na wallet para funcionar
- Os testes de validação requerem o contrato deployado
