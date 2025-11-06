#!/bin/bash

# Lido Service API Test Script
# This script tests the main endpoints of the Lido Service API

BASE_URL="http://localhost:3004"
API_BASE="$BASE_URL/api/lido"

echo "🚀 Testing Lido Service API"
echo "=========================="

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "Health check failed"
echo ""

# Test protocol info endpoint
echo "2. Testing protocol info endpoint..."
curl -s "$API_BASE/protocol/info" | jq '.' || echo "Protocol info failed"
echo ""

# Test position endpoint (with a sample address)
echo "3. Testing position endpoint..."
curl -s "$API_BASE/position/0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6" | jq '.' || echo "Position query failed"
echo ""

# Test staking history endpoint
echo "4. Testing staking history endpoint..."
curl -s "$API_BASE/history/0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6?limit=10" | jq '.' || echo "History query failed"
echo ""

# Test stake endpoint (this will fail without proper authentication)
echo "5. Testing stake endpoint (should fail without auth)..."
curl -s -X POST "$API_BASE/stake" \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6", "amount": "1.0"}' | jq '.' || echo "Stake request failed (expected without auth)"
echo ""

# Test unstake endpoint (this will fail without proper authentication)
echo "6. Testing unstake endpoint (should fail without auth)..."
curl -s -X POST "$API_BASE/unstake" \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6", "amount": "1.0"}' | jq '.' || echo "Unstake request failed (expected without auth)"
echo ""

# Test claim rewards endpoint (this will fail without proper authentication)
echo "7. Testing claim rewards endpoint (should fail without auth)..."
curl -s -X POST "$API_BASE/claim-rewards" \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"}' | jq '.' || echo "Claim rewards request failed (expected without auth)"
echo ""

echo "✅ API testing completed!"
echo ""
echo "Note: Authentication-required endpoints will fail without proper JWT tokens."
echo "To test with authentication, you need to:"
echo "1. Set up JWT_SECRET in your .env file"
echo "2. Generate valid JWT tokens for user addresses"
echo "3. Include 'Authorization: Bearer <token>' header in requests"
