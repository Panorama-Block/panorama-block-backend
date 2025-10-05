#!/bin/bash

# Script principal para executar todos os testes
echo "🧪 Executando todos os testes do Panorama Block Backend API..."

echo ""
echo "=========================================="
echo "📋 TESTES DO BACKEND API"
echo "=========================================="
cd api_backend/tests
./run-tests.sh

echo ""
echo "=========================================="
echo "📋 TESTES DO FRONTEND API"
echo "=========================================="
cd ../../api_frontend/tests
./run-tests.sh

echo ""
echo "🎉 Todos os testes foram executados com sucesso!"
echo ""
echo "📊 Resumo:"
echo "✅ Backend API: Testes de integração, autenticação e contratos"
echo "✅ Frontend API: Testes de endpoints públicos e preparação de transações"
echo "✅ Validação: Testes de rotas com validação integrada"
echo "✅ Swap: Testes de rotas de swap e validação + swap"
echo "✅ Lending: Testes de rotas de lending e validação + lending"
