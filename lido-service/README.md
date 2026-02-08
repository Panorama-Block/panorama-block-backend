# Lido Service

PanoramaBlock Lido Staking Service with Hexagonal Architecture

## Overview

This service provides a REST API for interacting with the Lido protocol for Ethereum staking. It implements a clean hexagonal architecture with domain-driven design principles.

## Features

- **Staking Operations**: Stake ETH to receive stETH tokens
- **Unstaking Operations**: Convert stETH back to ETH
- **Position Tracking**: Monitor staking positions and balances
- **Protocol Information**: Get real-time Lido protocol data
- **Transaction Status**: Track transaction status and history

## Architecture

The service follows hexagonal architecture (ports and adapters) with the following layers:

- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Use cases and services
- **Infrastructure Layer**: External integrations and implementations

## API Endpoints

### Authentication (Centralized)

This service uses the centralized `auth-service` (same as `liquid-swap-service`):

1. `POST {AUTH_SERVICE_URL}/auth/login` → get SIWE payload
2. Sign payload with wallet
3. `POST {AUTH_SERVICE_URL}/auth/verify` → receive JWT (`token`)
4. Call Lido endpoints with `Authorization: Bearer <token>`

**Important:** protected endpoints require `userAddress` in the body to match the authenticated JWT address.

### Staking Operations

#### POST /api/lido/stake
Stake ETH to receive stETH tokens.

**Request Body:**
```json
{
  "userAddress": "0x...",
  "amount": "1.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tx_...",
    "userAddress": "0x...",
    "type": "stake",
    "amount": "1.0",
    "token": "ETH",
    "status": "pending",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/lido/unstake
Convert stETH back to ETH.

**Request Body:**
```json
{
  "userAddress": "0x...",
  "amount": "1.0"
}
```

#### POST /api/lido/claim-rewards
Legacy/no-op endpoint.

> Note: Lido stETH is rebasing; there is no classic “claim rewards” flow. Rewards are reflected automatically in the stETH balance.

**Request Body:**
```json
{
  "userAddress": "0x..."
}
```

### Position and History

#### GET /api/lido/position/:userAddress
Get staking position for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pos_...",
    "userAddress": "0x...",
    "stakedAmount": "5000000000000000000",
    "stETHBalance": "5000000000000000000",
    "wstETHBalance": "0",
    "apy": 4.5,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "status": "active"
  }
}
```

#### GET /api/lido/history/:userAddress?limit=50
Get staking transaction history for a user.

#### GET /api/lido/portfolio/:userAddress?days=30
Get persisted portfolio snapshot:
- `assets`: current tracked balances (stETH + wstETH)
- `dailyMetrics`: daily time series (requires DB; otherwise empty)

### Withdrawals (Lido Withdrawal Queue)

#### GET /api/lido/withdrawals/:userAddress
List withdrawal requests and their on-chain status (`isFinalized`, `isClaimed`).

#### POST /api/lido/withdrawals/claim
Prepare a `claimWithdrawals(requestIds, hints)` transaction (requires JWT).

### Protocol Information

#### GET /api/lido/protocol/info
Get current Lido protocol information.

> Note: `currentAPY` can be `null` if the upstream protocol API is unavailable.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalStaked": "1000000000000000000000000",
    "currentAPY": 4.2,
    "lastUpdate": "2024-01-01T00:00:00.000Z"
  }
}
```

### Transaction Status

#### GET /api/lido/transaction/:transactionHash
Get transaction status by hash.

#### POST /api/lido/transaction/submit
Record the transaction hash for a previously prepared transaction (`id`) so it can show up in history (requires JWT).

## Environment Variables

```bash
# Server Configuration
PORT=3004
NODE_ENV=development
LOG_LEVEL=info

# Auth (centralized)
AUTH_SERVICE_URL=http://auth_service:3001

# Persistence (optional)
DATABASE_URL=postgresql://postgres:postgres@engine_postgres:5432/postgres

# Optional: isolate tables in a dedicated schema in the same database
LIDO_DB_SCHEMA=lido

# Ethereum (required)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_CHAIN_ID=1
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the service
npm start

# Development mode
npm run dev
```

## Docker

```bash
# Build Docker image
docker build -t lido-service .

# Run container
docker run -p 3004:3004 --env-file .env lido-service
```

## Development

The service uses TypeScript with the following structure:

```
src/
├── domain/                 # Domain layer
│   ├── entities/          # Business entities
│   └── interfaces/        # Repository interfaces
├── application/           # Application layer
│   ├── services/         # Business services
│   └── usecases/         # Use cases
└── infrastructure/       # Infrastructure layer
    ├── config/          # Configuration
    ├── repositories/    # Repository implementations
    ├── http/           # HTTP layer
    └── logs/           # Logging
```

## JWT Authentication

The service uses JWT (JSON Web Tokens) for authentication with the following features:

### Token Types
- **Access Token**: Short-lived (15 minutes) for API requests
- **Refresh Token**: Long-lived (7 days) for token renewal

### Authentication Flow
1. **Login**: POST `/api/lido/auth/login` with user address
2. **Get Tokens**: Receive access and refresh tokens
3. **API Requests**: Include `Authorization: Bearer <accessToken>` header
4. **Token Refresh**: Use refresh token to get new access token
5. **Logout**: Client-side token invalidation

### Usage Example
```javascript
// Login
const response = await fetch('/api/lido/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userAddress: '0x...' })
});

const { accessToken, refreshToken } = await response.json();

// Use token for protected requests
const stakeResponse = await fetch('/api/lido/stake', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userAddress: '0x...', amount: '1.0' })
});
```

## Security

- JWT-based authentication for protected endpoints
- Input validation for all requests
- Ethereum address format validation
- Amount validation to prevent overflow attacks
- Token expiration and refresh mechanism
- Secure token storage recommendations

## Error Handling

The service includes comprehensive error handling with:

- Input validation errors (400)
- Authentication errors (401)
- Not found errors (404)
- Internal server errors (500)
- Structured error responses with timestamps

## Logging

Structured logging with different levels:
- ERROR: Critical errors
- WARN: Warning messages
- INFO: General information
- DEBUG: Detailed debugging information

## License

MIT
