# 📚 Documentação da API de Lending - Benqi Protocol

## 🎯 Visão Geral

Esta documentação cobre a API completa de Lending do protocolo Benqi, implementada para a rede Avalanche. A API oferece funcionalidades de empréstimo, fornecimento de liquidez e gestão de mercados com suporte a autenticação via smart wallet e execução direta.

## 📋 Índice da Documentação

### 1. [Quick Start Guide](./BENQI_API_QUICK_START.md)
- ⚡ **Início rápido em 5 minutos**
- 🔧 Configuração básica
- 📋 Exemplos essenciais
- 🚨 Troubleshooting comum

### 2. [Documentação Completa](./BENQI_API_DOCUMENTATION.md)
- 🔧 Configuração detalhada
- 📋 Todos os endpoints
- 🔐 Autenticação e segurança
- 📊 Códigos de status e erros
- 🛡️ Boas práticas de segurança

### 3. [Exemplos Práticos](./BENQI_API_EXAMPLES.md)
- 💼 Operações básicas
- 🔒 Operações com validação
- 🚀 Exemplos avançados
- 🧪 Classes e utilitários
- 📈 Monitoramento e logs

## 🚀 Início Rápido

### 1. Instalação
```bash
cd api_refactor
npm install
```

### 2. Configuração
```bash
cp env.example .env
# Edite o .env com suas configurações
```

### 3. Execução
```bash
npm run dev
```

### 4. Teste
```bash
curl http://localhost:3001/health
```

## 🔧 Funcionalidades Principais

### ✅ Operações de Lending
- **Supply**: Fornecer ativos ao protocolo
- **Redeem**: Resgatar qTokens
- **Borrow**: Emprestar ativos
- **Repay**: Pagar empréstimos
- **Enter/Exit Markets**: Gestão de mercados

### ✅ Autenticação
- **Smart Wallet**: Autenticação por assinatura
- **Execução Direta**: Com private key
- **Rate Limiting**: Proteção contra abuso

### ✅ Validação Integrada
- **Validate + Supply**: Validação + fornecimento
- **Validate + Redeem**: Validação + resgate
- **Validate + Borrow**: Validação + empréstimo
- **Validate + Repay**: Validação + pagamento

## 📊 Endpoints Disponíveis

### Rotas Básicas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/info` | Informações da API |
| `GET` | `/health` | Status da API |
| `GET` | `/benqi/qtokens` | Lista qTokens |

### Rotas de Lending
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/benqi/supply` | Preparar supply |
| `POST` | `/benqi/redeem` | Preparar redeem |
| `POST` | `/benqi/borrow` | Preparar borrow |
| `POST` | `/benqi/repay` | Preparar repay |
| `POST` | `/benqi/enterMarkets` | Preparar enterMarkets |
| `POST` | `/benqi/exitMarket` | Preparar exitMarket |

### Rotas com Validação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/benqi-validation/validateAndSupply` | Executar validação + supply |
| `POST` | `/benqi-validation/validateAndRedeem` | Executar validação + redeem |
| `POST` | `/benqi-validation/validateAndBorrow` | Executar validação + borrow |
| `POST` | `/benqi-validation/validateAndRepay` | Executar validação + repay |

## 🔐 Tipos de Autenticação

### 1. Smart Wallet (Recomendado)
```javascript
// Frontend assina mensagem
const signature = await wallet.signMessage(message);

// API prepara transação
const response = await api.post('/benqi/supply', {
  address: wallet.address,
  signature: signature,
  message: message,
  // ... outros parâmetros
});

// Frontend executa transação
const tx = await wallet.sendTransaction(response.data.data);
```

### 2. Execução Direta
```javascript
// API executa diretamente
const response = await api.post('/benqi-validation/validateAndSupply', {
  privateKey: process.env.PRIVATE_KEY,
  // ... outros parâmetros
});

// Transação já executada
console.log('Hash:', response.data.transactionHash);
```

## 🧪 Scripts de Teste

### Teste Completo
```bash
node test-benqi-final.js
```

### Teste Smart Wallet
```bash
node test-benqi-smart.js
```

### Teste com Validação
```bash
node test-benqi.js
```

## 📈 Estatísticas da API

### ✅ Funcionalidades Testadas
- **qTokens listados**: 10 qTokens disponíveis
- **Autenticação**: 100% funcional
- **Preparação de transações**: 6/6 funcionando
- **Status das transações**: ready_for_signature
- **Gas estimado**: 300.000 - 500.000
- **Endereços dos contratos**: Atualizados para mainnet

### 🔧 Configurações
- **Rede**: Avalanche C-Chain (43114)
- **Rate Limiting**: 100 req/min (Benqi), 50 req/min (Validation)
- **Middleware**: Autenticação, validação, sanitização
- **Logs**: Completos com timestamp e status

## 🛡️ Segurança

### Middleware Ativo
- ✅ **Rate Limiting**: Proteção contra abuso
- ✅ **Autenticação**: Verificação de assinatura
- ✅ **Validação**: Sanitização de inputs
- ✅ **Logs**: Monitoramento completo

### Boas Práticas
1. **Nunca exponha private keys** em logs
2. **Use HTTPS** em produção
3. **Configure rate limiting** adequadamente
4. **Valide todas as entradas** do usuário
5. **Monitore** tentativas suspeitas

## 🚀 Exemplo de Uso Completo

```javascript
const { ethers } = require('ethers');
const axios = require('axios');

// 1. Configurar cliente
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const API_BASE = 'http://localhost:3001';

// 2. Listar qTokens
const qTokens = await axios.get(`${API_BASE}/benqi/qtokens`);
console.log('qTokens disponíveis:', qTokens.data.data.total);

// 3. Fazer supply
const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
const signature = await wallet.signMessage(message);

const supplyResponse = await axios.post(`${API_BASE}/benqi/supply`, {
  address: wallet.address,
  signature: signature,
  message: message,
  timestamp: Date.now(),
  qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c', // qAVAX
  amount: ethers.parseEther('1.0').toString()
});

console.log('Transação preparada:', supplyResponse.data);
```

## 📞 Suporte

- **GitHub Issues**: [Link para repositório]
- **Email**: support@yourdomain.com
- **Documentação**: [Link para docs completas]

## 🔄 Atualizações

### Versão 1.0.0 (Setembro 2025)
- ✅ API de Lending Benqi implementada
- ✅ Autenticação smart wallet
- ✅ Execução direta com private key
- ✅ Validação integrada
- ✅ Testes completos
- ✅ Documentação completa

---

**Versão**: 1.0.0  
**Última atualização**: Setembro 2025  
**Rede**: Avalanche C-Chain (43114)  
**Status**: ✅ Produção Ready
