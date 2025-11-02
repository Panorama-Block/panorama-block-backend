#!/bin/bash

# Script para comparar payloads entre Thirdweb e Uniswap
# Uso: ./compare-providers.sh

echo "🔍 Comparando providers: Thirdweb vs Uniswap Smart Router vs Uniswap Trading API"
echo ""

curl -X POST http://localhost:3002/debug/compare-providers \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "toToken": "native",
    "amount": "100000000000000000",
    "sender": "0xd6F31c5e32EE78A257A32cB6469BaB3F9fbd7561"
  }' | jq '.' > comparison-result.json

echo ""
echo "✅ Resultado salvo em: comparison-result.json"
echo ""
echo "📊 Resumo da comparação:"
jq '.comparison.providers | to_entries | map({provider: .key, success: .value.success})' comparison-result.json
