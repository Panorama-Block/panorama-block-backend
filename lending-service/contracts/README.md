# ValidatedLending Contract - Deploy Guide

## 📋 Overview

O contrato `ValidatedLending` combina validação de taxa + operações de lending do Benqi em **uma única transação**, melhorando significativamente a UX.

### Antes (2 assinaturas):
```
User assina → Validação (taxa 10%)
User assina → Supply (valor líquido 90%)
```

### Depois (1 assinatura):
```
User assina → ValidatedLending executa ambas automaticamente
```

---

## 🚀 Deploy

### 1. Instalar Dependências

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### 2. Configurar .env

Adicione as seguintes variáveis:

```env
# Private key para deploy (NÃO COMMITAR!)
PRIVATE_KEY_DEPLOY=0x...

# RPC URL
RPC_URL_AVALANCHE=https://api.avax.network/ext/bc/C/rpc

# Endereço do contrato de validação existente
VALIDATION_CONTRACT_ADDRESS=0x...

# API Key do Snowtrace (para verificação)
SNOWTRACE_API_KEY=...
```

### 3. Compilar Contrato

```bash
npx hardhat compile
```

### 4. Deploy na Avalanche

```bash
npx hardhat run contracts/deploy-validated-lending.js --network avalanche
```

### 5. Verificar no Snowtrace

```bash
npx hardhat verify --network avalanche <CONTRACT_ADDRESS> <VALIDATION_CONTRACT_ADDRESS>
```

---

## 🔧 Integração com Backend

### 1. Adicionar endereço ao constants.js

```javascript
// config/constants.js
const VALIDATED_LENDING = {
  CONTRACT_ADDRESS: process.env.VALIDATED_LENDING_CONTRACT || '0x...',
};
```

### 2. Criar Service

Criar `services/validatedLendingService.js`:

```javascript
const { ethers } = require('ethers');

const VALIDATED_LENDING_ABI = [
  'function validateAndSupplyAVAX(address qTokenAddress) external payable',
  'function validateAndBorrow(address qTokenAddress, uint256 borrowAmount) external payable',
  'function validateAndRepayAVAX(address qTokenAddress, uint256 repayAmount) external payable',
  'function validateAndWithdraw(address qTokenAddress, uint256 redeemAmount) external payable',
  'function calculateTax(uint256 amount) external view returns (uint256 taxAmount, uint256 netAmount)'
];

class ValidatedLendingService {
  constructor(provider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      VALIDATED_LENDING_CONTRACT,
      VALIDATED_LENDING_ABI,
      provider
    );
  }

  async prepareValidatedSupply(qTokenAddress, amount) {
    const transactionData = await this.contract.validateAndSupplyAVAX.populateTransaction(
      qTokenAddress,
      { value: amount, gasLimit: 500000 }
    );

    return {
      chainId: 43114,
      to: VALIDATED_LENDING_CONTRACT,
      value: amount.toString(),
      gas: '500000',
      data: transactionData.data,
      referenceId: this.generateReferenceId(),
      status: 'ready_for_signature',
      note: 'Transação única: Validação + Supply (1 assinatura)'
    };
  }

  // ... outras funções
}

module.exports = ValidatedLendingService;
```

### 3. Atualizar Routes

```javascript
// routes/benqiValidationRoutes.js
router.post('/validateAndSupply',
  verifySignature,
  async (req, res) => {
    const { amount, qTokenAddress } = req.body;

    const validatedLendingService = new ValidatedLendingService(provider);
    const txData = await validatedLendingService.prepareValidatedSupply(
      qTokenAddress,
      amount
    );

    res.json({
      status: 200,
      msg: 'success',
      data: txData
    });
  }
);
```

---

## 🧪 Testes

### Testar Localmente com Hardhat

```bash
npx hardhat test
```

### Testar na Fuji Testnet

```bash
npx hardhat run contracts/deploy-validated-lending.js --network fuji
```

---

## 📊 Gas Comparison

### Antes (2 transações):
- Validação: ~50,000 gas
- Supply: ~250,000 gas
- **Total: ~300,000 gas**

### Depois (1 transação):
- ValidatedSupply: ~280,000 gas
- **Total: ~280,000 gas**
- **Economia: ~7%** + melhor UX

---

## 🔒 Segurança

### Auditoria Recomendada

Antes de usar em produção:
1. ✅ Testar extensivamente na testnet
2. ✅ Fazer auditoria de segurança profissional
3. ✅ Testar com valores pequenos primeiro
4. ✅ Implementar timelock para funções administrativas

### Pontos de Atenção

- ⚠️ Contrato precisa ter permissão para interagir com Benqi
- ⚠️ Verificar gas limits adequados
- ⚠️ Validar que taxa de validação não mudou
- ⚠️ Testar todos os edge cases (amount 0, saldo insuficiente, etc)

---

## 🎯 Roadmap

- [ ] Deploy na mainnet Avalanche
- [ ] Auditoria de segurança
- [ ] Integração completa com frontend
- [ ] Adicionar suporte para tokens ERC20
- [ ] Implementar withdraw e repay
- [ ] Adicionar eventos e logs detalhados
- [ ] Criar dashboard de monitoramento

---

## 📚 Funções Disponíveis

### validateAndSupplyAVAX
Executa validação + supply de AVAX em uma transação.

**Parâmetros:**
- `qTokenAddress`: Endereço do qToken Benqi (ex: qAVAX)
- `msg.value`: Valor total em AVAX (taxa + supply)

### validateAndBorrow
Executa validação + borrow em uma transação.

**Parâmetros:**
- `qTokenAddress`: Endereço do qToken
- `borrowAmount`: Quantidade a emprestar
- `msg.value`: Valor da taxa em AVAX

### validateAndRepayAVAX
Executa validação + repay em uma transação.

**Parâmetros:**
- `qTokenAddress`: Endereço do qToken
- `repayAmount`: Quantidade a pagar
- `msg.value`: Valor total (taxa + repay)

### validateAndWithdraw
Executa validação + withdraw em uma transação.

**Parâmetros:**
- `qTokenAddress`: Endereço do qToken
- `redeemAmount`: Quantidade a sacar
- `msg.value`: Valor da taxa em AVAX

### calculateTax (view)
Calcula quanto será pago de taxa.

**Retorna:**
- `taxAmount`: Valor da taxa
- `netAmount`: Valor líquido após taxa

---

## 🆘 Troubleshooting

### "Insufficient funds"
- Certifique-se de enviar valor suficiente (taxa + operação)
- Verifique saldo de AVAX na carteira

### "Validation failed"
- Verifique se contrato de validação está correto
- Confirme que taxa está sendo calculada corretamente

### "Supply failed"
- Verifique se qToken address está correto
- Confirme que Benqi está aceitando deposits

---

**Desenvolvido por**: Panorama Block Team
**Data**: Novembro 2025
**Licença**: MIT
