# 🚨 ALERTA IMPORTANTE - CONTRATO DE VALIDAÇÃO

## ⚠️ **ATENÇÃO: CONTRATO DE VALIDAÇÃO PRECISA SER TROCADO**

### 📋 **Situação Atual:**
- **Contrato Atual**: `0x8513be0BD39c8B7d693A678ae2350Ffaa284E3cf`
- **Taxa Configurada**: 10%
- **Rede**: Avalanche Mainnet
- **Status**: ⚠️ **PRECISA SER SUBSTITUÍDO**

---

## 🔄 **PASSOS PARA TROCAR O CONTRATO:**

### **1. Deploy do Novo Contrato**

```bash
# Navegar para o diretório do lending-service
cd lending-service

# Fazer deploy do novo contrato
forge script script/DeployValidation.s.sol --rpc-url https://avalanche-mainnet.infura.io/v3/9ff045cf374041eeabdf13a4664ceced --private-key $PRIVATE_KEY --broadcast --verify

# Anotar o novo endereço do contrato retornado
```

### **2. Atualizar Arquivos de Configuração**

#### **A. Atualizar `.env` (Principal)**
```bash
# Editar o arquivo .env
nano .env

# Trocar a linha:
VALIDATION_CONTRACT_ADDRESS=0x8513be0BD39c8B7d693A678ae2350Ffaa284E3cf

# Para o novo endereço:
VALIDATION_CONTRACT_ADDRESS=0x[NOVO_ENDERECO_DO_CONTRATO]
```

#### **B. Atualizar `env.example`**
```bash
# Editar o arquivo env.example
nano env.example

# Trocar a linha:
VALIDATION_CONTRACT_ADDRESS=0x8513be0BD39c8B7d693A678ae2350Ffaa284E3cf

# Para o novo endereço:
VALIDATION_CONTRACT_ADDRESS=0x[NOVO_ENDERECO_DO_CONTRATO]
```

#### **C. Atualizar `config/constants.js`**
```bash
# Editar o arquivo config/constants.js
nano config/constants.js

# Trocar a linha:
CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '0x8513be0BD39c8B7d693A678ae2350Ffaa284E3cf',

# Para:
CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '0x[NOVO_ENDERECO_DO_CONTRATO]',
```

### **3. Reiniciar Serviços**

```bash
# Parar todos os serviços
pkill -f "node"
pkill -f "ts-node-dev"

# Reiniciar o lending-service
cd lending-service
npm run dev

# Reiniciar outros serviços conforme necessário
```

### **4. Verificar Funcionamento**

```bash
# Testar o novo contrato
curl -X POST http://localhost:3001/validation/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "signature": "0x...",
    "message": "Calculate tax\nTimestamp: 1234567890",
    "timestamp": 1234567890,
    "amount": "1000000000000000000"
  }'
```

---

## 🔧 **CONFIGURAÇÕES DO NOVO CONTRATO:**

### **Taxa Padrão Recomendada:**
- **Taxa Inicial**: 5% (mais competitiva)
- **Taxa Máxima**: 100%
- **Taxa Mínima**: 0%

### **Configurar Nova Taxa:**
```bash
# Usar a rota setTaxRate para configurar a taxa desejada
curl -X POST http://localhost:3001/validation/setTaxRate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x[OWNER_ADDRESS]",
    "signature": "0x...",
    "message": "Set tax rate\nTimestamp: 1234567890",
    "timestamp": 1234567890,
    "newTaxRate": "5",
    "privateKey": "0x[OWNER_PRIVATE_KEY]"
  }'
```

---

## 📝 **CHECKLIST DE VERIFICAÇÃO:**

- [ ] ✅ Novo contrato deployado na Avalanche Mainnet
- [ ] ✅ Endereço do contrato anotado
- [ ] ✅ Arquivo `.env` atualizado
- [ ] ✅ Arquivo `env.example` atualizado
- [ ] ✅ Arquivo `config/constants.js` atualizado
- [ ] ✅ Serviços reiniciados
- [ ] ✅ Teste de funcionamento realizado
- [ ] ✅ Nova taxa configurada (se necessário)
- [ ] ✅ Documentação atualizada

---

## 🚨 **IMPORTANTE:**

1. **Backup**: Faça backup dos arquivos antes de editar
2. **Teste**: Teste em ambiente de desenvolvimento primeiro
3. **Verificação**: Confirme que o novo contrato está funcionando
4. **Comunicação**: Informe a equipe sobre a mudança
5. **Monitoramento**: Monitore os logs após a troca

---

## 📞 **SUPORTE:**

Se houver problemas durante a troca:
1. Verifique os logs do serviço
2. Confirme se o novo contrato está deployado corretamente
3. Verifique se todos os arquivos foram atualizados
4. Teste as rotas de validação

---

**Data de Criação**: 2025-10-27  
**Status**: ⚠️ **PENDENTE**  
**Prioridade**: 🔴 **ALTA**
