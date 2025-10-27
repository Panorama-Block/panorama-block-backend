#!/bin/bash

# Script interativo para testar a API do Liquid Swap Service
# Uso: ./test-api-interactive.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuração
API_URL=${API_URL:-"http://localhost:3001"}

# Função para print colorido
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar se o servidor está rodando
check_server() {
    print_header "Verificando servidor..."

    if curl -s "$API_URL/health" > /dev/null 2>&1; then
        print_success "Servidor está rodando em $API_URL"
        return 0
    else
        print_error "Servidor não está respondendo em $API_URL"
        print_info "Execute: npm run dev"
        return 1
    fi
}

# Teste 1: Health Check
test_health() {
    print_header "Teste 1: Health Check"

    response=$(curl -s "$API_URL/health")

    echo "Resposta:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    if echo "$response" | grep -q "ok"; then
        print_success "Health check passou!"
    else
        print_error "Health check falhou!"
    fi
}

# Teste 2: Same-Chain Swap (Uniswap)
test_same_chain() {
    print_header "Teste 2: Same-Chain Swap (deve usar Uniswap)"

    print_info "Swap: ETH → USDC na Ethereum (chain 1)"

    response=$(curl -s -X POST "$API_URL/swap/quote" \
        -H "Content-Type: application/json" \
        -d '{
            "fromChainId": 1,
            "toChainId": 1,
            "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "amount": "0.01",
            "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        }')

    echo "Resposta:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    provider=$(echo "$response" | jq -r '.quote.provider' 2>/dev/null)

    if [ "$provider" = "uniswap" ]; then
        print_success "Provider correto: Uniswap para same-chain!"
    elif [ "$provider" = "thirdweb" ]; then
        print_warning "Provider: Thirdweb (fallback ativado - Uniswap pode estar indisponível)"
    else
        print_error "Provider inesperado: $provider"
    fi

    if echo "$response" | jq -e '.quote.estimatedReceiveAmount' > /dev/null 2>&1; then
        amount=$(echo "$response" | jq -r '.quote.estimatedReceiveAmount')
        print_info "Você receberá: $amount wei USDC"
    fi
}

# Teste 3: Cross-Chain Swap (Thirdweb)
test_cross_chain() {
    print_header "Teste 3: Cross-Chain Swap (deve usar Thirdweb)"

    print_info "Swap: USDC (Ethereum) → USDC (Polygon)"

    response=$(curl -s -X POST "$API_URL/swap/quote" \
        -H "Content-Type: application/json" \
        -d '{
            "fromChainId": 1,
            "toChainId": 137,
            "fromToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            "amount": "10",
            "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        }')

    echo "Resposta:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    provider=$(echo "$response" | jq -r '.quote.provider' 2>/dev/null)

    if [ "$provider" = "thirdweb" ]; then
        print_success "Provider correto: Thirdweb para cross-chain!"
    else
        print_error "Provider incorreto: $provider (esperado: thirdweb)"
    fi

    if echo "$response" | jq -e '.quote.estimatedReceiveAmount' > /dev/null 2>&1; then
        amount=$(echo "$response" | jq -r '.quote.estimatedReceiveAmount')
        print_info "Você receberá: $amount wei USDC na Polygon"
    fi
}

# Teste 4: Swap na Base (L2)
test_base_chain() {
    print_header "Teste 4: Swap na Base (L2)"

    print_info "Swap: ETH → USDC na Base (chain 8453)"

    response=$(curl -s -X POST "$API_URL/swap/quote" \
        -H "Content-Type: application/json" \
        -d '{
            "fromChainId": 8453,
            "toChainId": 8453,
            "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            "toToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "0.01",
            "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        }')

    echo "Resposta:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    provider=$(echo "$response" | jq -r '.quote.provider' 2>/dev/null)

    if [ "$provider" = "uniswap" ]; then
        print_success "Provider: Uniswap (Base é suportado!)"
    elif [ "$provider" = "thirdweb" ]; then
        print_warning "Provider: Thirdweb (fallback - Uniswap pode estar indisponível)"
    else
        print_error "Provider inesperado: $provider"
    fi
}

# Teste 5: Prepare Swap
test_prepare() {
    print_header "Teste 5: Prepare Swap Transaction"

    print_info "Preparando swap: ETH → USDC na Ethereum"

    response=$(curl -s -X POST "$API_URL/swap/tx" \
        -H "Content-Type: application/json" \
        -d '{
            "fromChainId": 1,
            "toChainId": 1,
            "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "amount": "10000000000000000",
            "sender": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        }')

    echo "Resposta:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    provider=$(echo "$response" | jq -r '.provider' 2>/dev/null)

    if [ "$provider" != "null" ] && [ -n "$provider" ]; then
        print_success "Provider que preparou a transação: $provider"
    fi

    if echo "$response" | jq -e '.prepared.transactions' > /dev/null 2>&1; then
        tx_count=$(echo "$response" | jq '.prepared.transactions | length')
        print_info "Transações preparadas: $tx_count"
    fi
}

# Menu interativo
show_menu() {
    echo -e "\n${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Liquid Swap Service - Test Menu      ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}\n"

    echo "1) Health Check"
    echo "2) Same-Chain Swap (Uniswap)"
    echo "3) Cross-Chain Swap (Thirdweb)"
    echo "4) Swap na Base (L2)"
    echo "5) Prepare Swap Transaction"
    echo "6) Rodar TODOS os testes"
    echo "0) Sair"
    echo ""
    echo -n "Escolha uma opção: "
}

run_all_tests() {
    check_server || exit 1
    test_health
    test_same_chain
    test_cross_chain
    test_base_chain
    test_prepare

    print_header "Resumo dos Testes"
    print_success "Todos os testes foram executados!"
    print_info "Verifique os resultados acima"
}

# Main
main() {
    # Verificar se jq está instalado
    if ! command -v jq &> /dev/null; then
        print_warning "jq não está instalado. Instale para melhor formatação:"
        print_info "sudo apt-get install jq  # Ubuntu/Debian"
        print_info "brew install jq          # macOS"
    fi

    # Verificar servidor no início
    if ! check_server; then
        echo ""
        echo -e "${YELLOW}Deseja continuar mesmo assim? (y/n)${NC} "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Loop do menu
    while true; do
        show_menu
        read -r choice

        case $choice in
            1)
                test_health
                ;;
            2)
                test_same_chain
                ;;
            3)
                test_cross_chain
                ;;
            4)
                test_base_chain
                ;;
            5)
                test_prepare
                ;;
            6)
                run_all_tests
                ;;
            0)
                print_info "Saindo..."
                exit 0
                ;;
            *)
                print_error "Opção inválida!"
                ;;
        esac

        echo ""
        echo -n "Pressione ENTER para continuar..."
        read -r
    done
}

# Executar
main
