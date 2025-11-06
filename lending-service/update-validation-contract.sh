#!/bin/bash

# 🚨 Script para Atualizar Contrato de Validação
# Uso: ./update-validation-contract.sh <NOVO_ENDERECO>

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar se o novo endereço foi fornecido
if [ -z "$1" ]; then
    echo -e "${RED}❌ Erro: Forneça o novo endereço do contrato${NC}"
    echo -e "${YELLOW}Uso: ./update-validation-contract.sh 0x[NOVO_ENDERECO]${NC}"
    exit 1
fi

NEW_CONTRACT_ADDRESS=$1
OLD_CONTRACT_ADDRESS="0x8513be0BD39c8B7d693A678ae2350Ffaa284E3cf"

echo -e "${BLUE}🔄 Atualizando Contrato de Validação...${NC}"
echo -e "${YELLOW}Endereço antigo: ${OLD_CONTRACT_ADDRESS}${NC}"
echo -e "${YELLOW}Endereço novo: ${NEW_CONTRACT_ADDRESS}${NC}"
echo ""

# Verificar se o endereço tem formato válido
if [[ ! $NEW_CONTRACT_ADDRESS =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo -e "${RED}❌ Erro: Endereço inválido. Deve ser um endereço Ethereum válido (0x...40 caracteres)${NC}"
    exit 1
fi

# 1. Fazer backup dos arquivos
echo -e "${BLUE}📁 Fazendo backup dos arquivos...${NC}"
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
cp env.example env.example.backup.$(date +%Y%m%d_%H%M%S)
cp config/constants.js config/constants.js.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Backup criado${NC}"

# 2. Atualizar .env
echo -e "${BLUE}🔧 Atualizando .env...${NC}"
if [ -f .env ]; then
    sed -i "s|VALIDATION_CONTRACT_ADDRESS=.*|VALIDATION_CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}|g" .env
    echo -e "${GREEN}✅ .env atualizado${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
fi

# 3. Atualizar env.example
echo -e "${BLUE}🔧 Atualizando env.example...${NC}"
sed -i "s|VALIDATION_CONTRACT_ADDRESS=.*|VALIDATION_CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}|g" env.example
echo -e "${GREEN}✅ env.example atualizado${NC}"

# 4. Atualizar config/constants.js
echo -e "${BLUE}🔧 Atualizando config/constants.js...${NC}"
sed -i "s|CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '.*'|CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '${NEW_CONTRACT_ADDRESS}'|g" config/constants.js
echo -e "${GREEN}✅ config/constants.js atualizado${NC}"

# 5. Verificar se as alterações foram aplicadas
echo -e "${BLUE}🔍 Verificando alterações...${NC}"

# Verificar .env
if [ -f .env ]; then
    if grep -q "VALIDATION_CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}" .env; then
        echo -e "${GREEN}✅ .env: Contrato atualizado corretamente${NC}"
    else
        echo -e "${RED}❌ .env: Falha na atualização${NC}"
    fi
fi

# Verificar env.example
if grep -q "VALIDATION_CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}" env.example; then
    echo -e "${GREEN}✅ env.example: Contrato atualizado corretamente${NC}"
else
    echo -e "${RED}❌ env.example: Falha na atualização${NC}"
fi

# Verificar config/constants.js
if grep -q "CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '${NEW_CONTRACT_ADDRESS}'" config/constants.js; then
    echo -e "${GREEN}✅ config/constants.js: Contrato atualizado corretamente${NC}"
else
    echo -e "${RED}❌ config/constants.js: Falha na atualização${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Atualização concluída!${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo -e "1. Reiniciar o serviço: ${BLUE}npm run dev${NC}"
echo -e "2. Testar o contrato: ${BLUE}curl -X POST http://localhost:3001/validation/calculate${NC}"
echo -e "3. Configurar nova taxa se necessário"
echo ""
echo -e "${BLUE}📁 Backups criados em:${NC}"
echo -e "   - .env.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "   - env.example.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "   - config/constants.js.backup.$(date +%Y%m%d_%H%M%S)"
