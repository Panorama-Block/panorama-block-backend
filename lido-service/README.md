# Lido Service

PanoramaBlock Lido Staking Service with Hexagonal Architecture

## Overview

This service provides a REST API for interacting with the Lido protocol for Ethereum staking. It implements a clean hexagonal architecture with domain-driven design principles.

## Features

- **Staking Operations**: Stake ETH to receive stETH tokens
- **Unstaking Operations**: Convert stETH back to ETH
- **Rewards Management**: Claim staking rewards
- **Position Tracking**: Monitor staking positions and balances
- **Protocol Information**: Get real-time Lido protocol data
- **Transaction Status**: Track transaction status and history

## Architecture

The service follows hexagonal architecture (ports and adapters) with the following layers:

- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Use cases and services
- **Infrastructure Layer**: External integrations and implementations

## API Endpoints

### Authentication

#### POST /api/lido/auth/login
Login with user address to get JWT tokens.

**Request Body:**
```json
{
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userAddress": "0x...",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

#### POST /api/lido/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

#### GET /api/lido/auth/verify
Verify access token validity.

**Headers:**
```
Authorization: Bearer <accessToken>
```

#### GET /api/lido/auth/token-info
Get token information without verification.

#### POST /api/lido/auth/logout
Logout (client-side token invalidation).

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
Claim accumulated staking rewards.

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
    "stakedAmount": "5.0",
    "stETHBalance": "5.0",
    "wstETHBalance": "0.0",
    "rewards": "0.1",
    "apy": 4.5,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "status": "active"
  }
}
```

#### GET /api/lido/history/:userAddress?limit=50
Get staking transaction history for a user.

### Protocol Information

#### GET /api/lido/protocol/info
Get current Lido protocol information.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalStaked": "1000000.0",
    "totalRewards": "45000.0",
    "currentAPY": 4.5,
    "stETHPrice": "1.0",
    "wstETHPrice": "1.0",
    "lastUpdate": "2024-01-01T00:00:00.000Z"
  }
}
```

### Transaction Status

#### GET /api/lido/transaction/:transactionHash
Get transaction status by hash.

## Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Server Configuration
PORT=3004
NODE_ENV=development

# Ethereum Network Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_CHAIN_ID=1

# Lido Protocol Configuration
LIDO_STETH_CONTRACT=0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
LIDO_WSTETH_CONTRACT=0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0
LIDO_REWARDS_CONTRACT=0x00000000219ab540356cBB839Cbe05303d7705Fa

# Thirdweb Configuration
THIRDWEB_CLIENT_ID=your_thirdweb_client_id
THIRDWEB_SECRET_KEY=your_thirdweb_secret_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_ISSUER=lido-service
JWT_AUDIENCE=panorama-block
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
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
