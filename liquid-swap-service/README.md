# PanoramaBlock Liquid Swap Service

🔄 **Multi-Provider** swap aggregation service with intelligent routing, built using **Hexagonal Architecture** and **Domain-Driven Design**.

## 🌟 Multi-Provider System

The service now supports **multiple swap providers** with automatic intelligent routing:

- **Uniswap Trading API v1** - Optimized for same-chain swaps (15 chains)
- **Thirdweb Bridge API** - Cross-chain swaps and universal fallback

**Key Features**:
- ✨ Automatic provider selection (Uniswap for same-chain, Thirdweb for cross-chain)
- 🔄 Graceful fallback when preferred provider fails
- 📊 Provider information exposed to frontend
- 🎯 20/20 comprehensive unit tests passing

📖 **[Full Multi-Provider Documentation →](./MULTI_PROVIDER_SYSTEM.md)**

## 🏗️ Architecture

This service implements a **Hexagonal Architecture** (Ports and Adapters) with the following layers:

```
src/
├── domain/                 # Business Logic (Core)
│   ├── entities/          # Domain entities
│   ├── ports/             # Interfaces (ports)
│   └── services/          # Domain services
├── application/           # Use Cases (Application Logic)
│   └── usecases/          # Application use cases
├── infrastructure/        # External Adapters
│   ├── adapters/          # External service adapters
│   ├── http/              # HTTP layer (controllers, routes)
│   └── di/                # Dependency injection
└── config/                # Configuration management
```

## ✨ Features

- 🌐 **Multi-Provider Routing** - Intelligent selection between Uniswap and Thirdweb
- 🌉 **Cross-chain swaps** across 15+ major blockchains
- ⚡ **Optimized same-chain swaps** via Uniswap Trading API
- 🔄 **Automatic fallback** when providers fail
- 📊 **Real-time monitoring** of transaction status
- 📝 **Swap history** tracking
- 🔒 **JWT authentication** integration
- 🎯 **Clean Architecture** with dependency injection
- 📈 **Comprehensive logging** and error handling
- ✅ **20/20 unit tests** passing with full coverage

## 🌐 Supported Chains

### Uniswap Trading API v1 (Same-Chain Swaps)

| Chain ID | Network | Symbol |
|----------|---------|--------|
| 1 | Ethereum Mainnet | ETH |
| 10 | Optimism | ETH |
| 137 | Polygon | MATIC |
| 8453 | Base | ETH |
| 42161 | Arbitrum One | ETH |
| 43114 | Avalanche | AVAX |
| 56 | BNB Chain | BNB |
| 324 | zkSync Era | ETH |
| 81457 | Blast | ETH |
| 7777777 | Zora | ETH |
| 130 | Ink | ETH |
| 480 | World Chain | WLD |
| 57073 | Abstract | ETH |
| 1868 | Soneium | ETH |
| 42220 | Celo | CELO |

### Thirdweb Bridge (Cross-Chain + Fallback)

All major EVM chains supported by Thirdweb Bridge API.

## 🚀 Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
# Thirdweb Configuration
THIRDWEB_CLIENT_ID=your_client_id
AUTH_PRIVATE_KEY=your_secret_key

# Wallet Configuration
PRIVATE_KEY=your_wallet_private_key
SWAP_SENDER_ADDRESS=0x...
SWAP_RECEIVER_ADDRESS=0x...

# Uniswap Smart Router Configuration (Optional)
UNISWAP_SLIPPAGE_BPS=500  # Default: 500 (5%). Increase if getting V2_TOO_LITTLE_RECEIVED errors

# Optional: Custom RPC URLs
ETHEREUM_RPC_URL=https://your-ethereum-rpc.com
POLYGON_RPC_URL=https://your-polygon-rpc.com
```

### 2. Installation & Run

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 📡 API Endpoints

### Health
```http
GET /health
```

### Quote
```http
POST /swap/quote  (JWT)
Content-Type: application/json
{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000",
  "unit": "wei"
}
```

### Prepare (non-custodial)
```http
POST /swap/tx  (JWT)
Content-Type: application/json
{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000",
  "receiver": "0x...optional"
}
```

### Execute via Engine (optional)
Enabled when `ENGINE_ENABLED=true`.
```http
POST /swap/execute  (JWT)
Content-Type: application/json
{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x2791...",
  "amount": "1000000000000000",
  "receiver": "0x...optional",
  "smartAccountAddress": "0xSmartAccount",
  "signerAddress": "0xSessionKey"
}
```

### Swap History
```http
GET /swap/history  (JWT)
```

### Status
```http
GET /swap/status/:transactionHash?chainId={originChainId}  (JWT)
```

## 🧪 Testing Examples

Use the helper script:
```bash
AUTH_TOKEN=eyJ... ./test-api.sh 3002
```

To test Engine execution:
```bash
ENGINE_ENABLED=true SMART_ACCOUNT=0x... SESSION_KEY=0x... AUTH_TOKEN=eyJ... ./test-api.sh 3002
```

## 🔧 Domain Logic

### Entities
- **SwapRequest**: Represents a swap request with validation
- **SwapQuote**: Contains swap pricing and estimation data
- **SwapTransaction**: Individual blockchain transaction
- **SwapResult**: Complete swap operation result

### Use Cases
- **GetQuoteUseCase**: Returns cross-chain quote (+ USD enrichment)
- **PrepareSwapUseCase**: Returns origin-chain steps/transactions bundle
- **ExecuteSwapUseCase**: Prepares and executes origin txs via Engine (when enabled)
- **GetSwapStatusUseCase**: Returns Universal Bridge status by origin tx hash
- **GetSwapHistoryUseCase**: Retrieves user's swap history

### Adapters
- **ThirdwebSwapAdapter**: Integrates with ThirdWeb Bridge SDK
- **ChainProviderAdapter**: Manages blockchain connections
- **SwapRepositoryAdapter**: Handles data persistence

## ⚠️ Implementation Status

### Current State
This service is built with **production-ready hexagonal architecture** and includes:
- ✅ Complete domain layer with business entities and validation
- ✅ Application layer with use cases and orchestration  
- ✅ Infrastructure layer with adapters and dependency injection
- ✅ HTTP layer with controllers, routes, and middleware
- ✅ ThirdWeb SDK v5 integration (client initialization)

### Bridge API Integration
**Real ThirdWeb Universal Bridge implementation**:
- ✅ Quote generation using `Bridge.Sell.quote()`
- ✅ Transaction preparation using `Bridge.Sell.prepare()`
- ✅ Status monitoring using `Bridge.status()`
- ✅ Based on working implementation from service-thirdweb

### Production Deployment
The service uses real ThirdWeb Universal Bridge API:
1. ✅ Uses official `Bridge, NATIVE_TOKEN_ADDRESS` imports from "thirdweb"
2. ✅ Configure ThirdWeb Client ID in environment variables
3. ✅ Supports cross-chain swaps on all major networks
4. ✅ Real-time transaction monitoring and status tracking (via `/swap/status`)

### Engine & Session Key

Optional server-side execution using thirdweb Engine + ERC‑4337 session key when `ENGINE_ENABLED=true`.

Env vars:
```
ENGINE_ENABLED=true
ENGINE_URL=http://engine:3005
ENGINE_ACCESS_TOKEN=your-engine-token
```

## 🔒 Security

- JWT token validation for all swap operations
- Environment variable validation on startup
- Input validation at domain level
- Error handling without sensitive data exposure

## 📊 Monitoring

All operations include comprehensive logging:
- Request/response tracking
- Transaction status monitoring  
- Error reporting with context
- Performance metrics

## 🛠️ Development

### Architecture Principles
- **Domain-Driven Design**: Business logic in domain layer
- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Open for extension, closed for modification

### Adding New Chains
1. Add chain configuration to `ChainProviderAdapter`
2. Update RPC URL mapping in `ThirdwebSwapAdapter`
3. Add chain info to supported chains list

### Adding New Features
1. Define domain entities and rules
2. Create use case in application layer
3. Implement adapters for external services
4. Wire dependencies in DI container

## 📝 License

MIT License - PanoramaBlock Team 
