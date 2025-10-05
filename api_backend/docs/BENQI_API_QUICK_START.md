# ⚡ Quick Start - API de Lending Benqi

## 🚀 Início Rápido (5 minutos)

### 1. Pré-requisitos
```bash
# Node.js 18+
node --version

# npm ou yarn
npm --version
```

### 2. Instalação
```bash
# Clone o repositório
git clone <repository-url>
cd panorama-block-backend/api_refactor

# Instale dependências
npm install

# Configure variáveis de ambiente
cp env.example .env
```

### 3. Configuração do .env
```bash
# .env
RPC_URL=https://api.avax.network/ext/bc/C/rpc
PRIVATE_KEY=0x1234567890abcdef...
PORT=3001
```

### 4. Executar API
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

### 5. Testar API
```bash
# Health check
curl http://localhost:3001/health

# Listar qTokens
curl http://localhost:3001/benqi/qtokens
```

## 📋 Exemplos Básicos

### Exemplo 1: Listar qTokens
```javascript
const axios = require('axios');

async function getQTokens() {
  const response = await axios.get('http://localhost:3001/benqi/qtokens');
  console.log(response.data);
}

getQTokens();
```

### Exemplo 2: Supply de AVAX
```javascript
const { ethers } = require('ethers');
const axios = require('axios');

async function supplyAVAX() {
  // 1. Criar wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  
  // 2. Criar assinatura
  const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
  const signature = await wallet.signMessage(message);
  
  // 3. Fazer requisição
  const response = await axios.post('http://localhost:3001/benqi/supply', {
    address: wallet.address,
    signature: signature,
    message: message,
    timestamp: Date.now(),
    qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c', // qAVAX
    amount: ethers.parseEther('1.0').toString() // 1 AVAX
  });
  
  console.log('Transação preparada:', response.data);
}

supplyAVAX();
```

### Exemplo 3: Validação + Supply
```javascript
async function validateAndSupply() {
  const response = await axios.post('http://localhost:3001/benqi-validation/validateAndSupply', {
    privateKey: process.env.PRIVATE_KEY,
    qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
    amount: ethers.parseEther('1.0').toString()
  });
  
  console.log('Transação executada:', response.data);
}

validateAndSupply();
```

## 🔧 Scripts de Teste

### Teste Completo
```bash
# Executar todos os testes
node test-benqi-final.js
```

### Teste Smart Wallet
```bash
# Testar apenas rotas sem validação
node test-benqi-smart.js
```

### Teste com Validação
```bash
# Testar rotas com validação
node test-benqi.js
```

## 📊 Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/benqi/qtokens` | Lista qTokens disponíveis |
| `POST` | `/benqi/supply` | Preparar supply |
| `POST` | `/benqi/redeem` | Preparar redeem |
| `POST` | `/benqi/borrow` | Preparar borrow |
| `POST` | `/benqi/repay` | Preparar repay |
| `POST` | `/benqi/enterMarkets` | Preparar enterMarkets |
| `POST` | `/benqi/exitMarket` | Preparar exitMarket |
| `POST` | `/benqi-validation/validateAndSupply` | Executar validação + supply |
| `POST` | `/benqi-validation/validateAndRedeem` | Executar validação + redeem |
| `POST` | `/benqi-validation/validateAndBorrow` | Executar validação + borrow |
| `POST` | `/benqi-validation/validateAndRepay` | Executar validação + repay |

## 🎯 Fluxo Típico de Uso

### 1. Frontend (Smart Wallet)
```javascript
// 1. Usuário conecta wallet
const wallet = await connectWallet();

// 2. Frontend prepara transação
const response = await fetch('/benqi/supply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: wallet.address,
    signature: await wallet.signMessage(message),
    message: message,
    timestamp: Date.now(),
    qTokenAddress: qAVAX,
    amount: '1000000000000000000'
  })
});

// 3. Frontend executa transação
const txData = await response.json();
const tx = await wallet.sendTransaction(txData.data);
```

### 2. Backend (Execução Direta)
```javascript
// 1. Backend executa diretamente
const response = await fetch('/benqi-validation/validateAndSupply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    privateKey: process.env.PRIVATE_KEY,
    qTokenAddress: qAVAX,
    amount: '1000000000000000000'
  })
});

// 2. Transação já executada
const result = await response.json();
console.log('Hash:', result.data.transactionHash);
```

## 🚨 Troubleshooting

### Erro: "Invalid signature"
```bash
# Verificar se a mensagem está correta
const message = `POST /benqi/supply\nTimestamp: ${Date.now()}`;
```

### Erro: "Invalid qToken address"
```bash
# Usar endereços corretos
const qAVAX = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
```

### Erro: "Insufficient funds"
```bash
# Verificar saldo da wallet
const balance = await provider.getBalance(wallet.address);
console.log('Saldo:', ethers.formatEther(balance), 'AVAX');
```

### Erro: "Rate limit exceeded"
```bash
# Aguardar antes de nova requisição
await new Promise(resolve => setTimeout(resolve, 1000));
```

## 📚 Próximos Passos

1. **Leia a documentação completa**: [BENQI_API_DOCUMENTATION.md](./BENQI_API_DOCUMENTATION.md)
2. **Veja exemplos práticos**: [BENQI_API_EXAMPLES.md](./BENQI_API_EXAMPLES.md)
3. **Teste todas as funcionalidades**: Execute os scripts de teste
4. **Configure para produção**: Ajuste rate limiting e logs

## 🆘 Suporte

- **GitHub Issues**: [Link para repositório]
- **Email**: support@yourdomain.com
- **Documentação**: [Link para docs completas]

---

**Tempo de setup**: ~5 minutos  
**Dependências**: Node.js, npm, ethers.js  
**Rede**: Avalanche C-Chain (43114)
