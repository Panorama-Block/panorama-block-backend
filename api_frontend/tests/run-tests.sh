#!/bin/bash

# Script para executar testes do frontend
echo "🧪 Executando testes do Frontend API..."

# Verificar se o backend está rodando
echo "🔍 Verificando se o backend está rodando..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend está rodando"
else
    echo "❌ Backend não está rodando. Iniciando..."
    cd ../api_backend
    node index.js &
    BACKEND_PID=$!
    echo "⏳ Aguardando backend inicializar..."
    sleep 5
    
    # Verificar novamente
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✅ Backend iniciado com sucesso"
    else
        echo "❌ Falha ao iniciar backend"
        exit 1
    fi
fi

# Verificar se o frontend está rodando
echo "🔍 Verificando se o frontend está rodando..."
if curl -s http://localhost:3002/health > /dev/null; then
    echo "✅ Frontend está rodando"
else
    echo "❌ Frontend não está rodando. Iniciando..."
    cd ../api_frontend
    node index.js &
    FRONTEND_PID=$!
    echo "⏳ Aguardando frontend inicializar..."
    sleep 3
    
    # Verificar novamente
    if curl -s http://localhost:3002/health > /dev/null; then
        echo "✅ Frontend iniciado com sucesso"
    else
        echo "❌ Falha ao iniciar frontend"
        exit 1
    fi
fi

echo ""
echo "🚀 Executando testes..."

# Executar teste principal
echo "📋 Teste 1: Executando teste principal..."
node test-frontend.js

echo ""
echo "📋 Teste 2: Executando testes de swap..."
node test-swap-routes.js

echo ""
echo "📋 Teste 3: Executando testes de lending..."
node test-validation-lending.js

echo ""
echo "🎉 Todos os testes foram executados!"

# Se as APIs foram iniciadas por este script, parar os processos
if [ ! -z "$BACKEND_PID" ]; then
    echo "🛑 Parando backend..."
    kill $BACKEND_PID
fi

if [ ! -z "$FRONTEND_PID" ]; then
    echo "🛑 Parando frontend..."
    kill $FRONTEND_PID
fi
