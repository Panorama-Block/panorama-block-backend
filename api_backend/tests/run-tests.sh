#!/bin/bash

# Script para executar testes do backend
echo "🧪 Executando testes do Backend API..."

# Verificar se o backend está rodando
echo "🔍 Verificando se o backend está rodando..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend está rodando"
else
    echo "❌ Backend não está rodando. Iniciando..."
    cd ..
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

echo ""
echo "🚀 Executando testes..."

# Executar teste principal
echo "📋 Teste 1: Executando teste principal..."
node test.js

echo ""
echo "📋 Teste 2: Executando teste core..."
node test-core-js.js

echo ""
echo "🎉 Todos os testes foram executados!"

# Se o backend foi iniciado por este script, parar o processo
if [ ! -z "$BACKEND_PID" ]; then
    echo "🛑 Parando backend..."
    kill $BACKEND_PID
fi
