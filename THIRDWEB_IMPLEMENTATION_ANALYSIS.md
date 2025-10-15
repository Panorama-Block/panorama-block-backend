# Thirdweb Implementation Analysis - Liquid Swap Service

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Flow Diagrams](#flow-diagrams)
4. [Key Interfaces and Implementations](#key-interfaces-and-implementations)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Transaction Preparation and Execution](#transaction-preparation-and-execution)
7. [Dependencies Between Components](#dependencies-between-components)
8. [Authentication and Authorization](#authentication-and-authorization)
9. [Environment Variables](#environment-variables)

---

## Architecture Overview

The liquid-swap-service implements a **Hexagonal Architecture** (Ports and Adapters pattern) with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                  │
│  - HTTP Controllers (SwapController)                    │
│  - Routes (swapRouter)                                  │
│  - Adapters (ThirdwebSwapAdapter, EngineExecutionAdapter)│
│  - Middleware (authMiddleware)                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  - Use Cases (GetQuoteUseCase, PrepareSwapUseCase,     │
│               ExecuteSwapUseCase, GetSwapStatusUseCase) │
│  - Services (PriceService)                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                      Domain Layer                        │
│  - Entities (SwapRequest, SwapQuote, SwapResult)        │
│  - Services (SwapDomainService)                         │
│  - Ports (ISwapService, IExecutionPort, IChainProvider) │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Non-Custodial V1**: Server prepares transactions, client signs and sends
2. **Optional Engine Execution**: ERC-4337 smart account execution via Thirdweb Engine
3. **JWT Authentication**: All swap endpoints protected via auth-service
4. **Dependency Injection**: Singleton DIContainer manages all dependencies
5. **BigInt for Wei Values**: All token amounts handled as BigInt to avoid precision loss

---

## Core Components

### 1. ThirdwebSwapAdapter (`src/infrastructure/adapters/thirdweb.swap.adapter.ts`)

**Purpose**: Main adapter implementing `ISwapService` port using Thirdweb SDK

**Key Methods**:

#### `getQuote(swapRequest: SwapRequest): Promise<SwapQuote>`
- Uses `Bridge.Sell.quote()` from Thirdweb SDK
- Converts native token addresses using `NATIVE_TOKEN_ADDRESS`
- Calculates decimals-aware exchange rate
- Returns `SwapQuote` with estimated receive amount, fees, duration

#### `prepareSwap(swapRequest: SwapRequest): Promise<any>`
- Uses `Bridge.Sell.prepare()` to get transaction bundle
- Returns prepared transactions (approve + swap) for client signing
- Includes debug logging for preflight quote validation
- **CRITICAL**: This is the primary method in V1 non-custodial mode

#### `executeSwap(swapRequest: SwapRequest): Promise<SwapResult>`
- **DISABLED** in V1 non-custodial mode
- Throws error directing users to use `prepareSwap()`
- Server-side execution moved to Engine adapter when enabled

#### `monitorTransaction(transactionHash: string, chainId: number): Promise<string>`
- Uses `Bridge.status()` to check transaction status
- Maps Thirdweb status to internal `TransactionStatus` enum
- Returns: `COMPLETED`, `PENDING`, or `FAILED`

**Error Handling**:
- Extracts `statusCode`, `code`, and `correlationId` from errors
- Comprehensive error messages with all available context
- Console logging for debugging

---

### 2. EngineExecutionAdapter (`src/infrastructure/adapters/engine.execution.adapter.ts`)

**Purpose**: Executes prepared transactions via Thirdweb Engine using ERC-4337 session keys

**Key Features**:

#### Constructor
- Validates `ENGINE_URL` and `ENGINE_ACCESS_TOKEN`
- Initializes `EngineTokenManager` for token handling
- Only instantiated when `ENGINE_ENABLED=true`

#### `executeOriginTxs(txs, options, meta): Promise<ExecutionResult[]>`
- Formats transactions for Engine smart-wallet API
- Tries multiple endpoint candidates: `/smart-wallet/send-transaction`, `/transactions/send`
- Handles BigInt serialization in JSON
- Auto-retries on 401 with token refresh
- Returns `transactionHash`, `chainId`, and `userOpHash` for each tx

**Payload Structure**:
```typescript
{
  transactions: [{
    chainId: number,
    to: string,
    data: string,
    value: string
  }],
  executionOptions: {
    type: "ERC4337",
    smartAccountAddress: string,
    signerAddress: string
  },
  from: string
}
```

---

### 3. EngineTokenManager (`src/infrastructure/adapters/engine.token.manager.ts`)

**Purpose**: Manages Engine access tokens with automatic refresh

**Features**:
- **Static Token Mode**: Uses `ENGINE_ACCESS_TOKEN` from env
- **Dynamic Login Mode**: Uses Thirdweb Engine SDK with `clientId` + `secretKey`
- **JWT Expiry Detection**: Decodes JWT to check expiration (60s buffer)
- **Auto-Refresh**: Refreshes token before expiration
- **Fallback**: Reuses static token if no refresh credentials available

**Methods**:
- `getToken()`: Returns valid token, refreshing if needed
- `invalidate()`: Clears cached token (used on 401 errors)
- `isValid()`: Checks if current token is still valid

---

### 4. ChainProviderAdapter (`src/infrastructure/adapters/chain.provider.adapter.ts`)

**Purpose**: Manages RPC providers for supported chains

**Supported Chains**:
- Ethereum (1)
- Polygon (137)
- BSC (56)
- Base (8453)
- Optimism (10)
- Arbitrum (42161)
- Avalanche (43114)

**Key Features**:
- RPC URL configuration per chain (env vars or defaults)
- `getSigner()` disabled in non-custodial mode (throws error)
- Provider info stored for debugging

---

### 5. Utility Files

#### `thirdwebClient.ts`
- Creates singleton Thirdweb client
- Uses `THIRDWEB_CLIENT_ID` (required) and `THIRDWEB_SECRET_KEY` (optional)
- Used by token utilities and price service

#### `token.utils.ts`
- **`getTokenDecimals(chainId, tokenAddress)`**: Fetches decimals from Thirdweb Bridge.tokens
- **`toWei(amountHuman, decimals)`**: Converts human-readable amount to wei
- **`fromWei(amountWei, decimals)`**: Converts wei to human-readable amount
- Implements decimals cache for performance

#### `native.utils.ts`
- **`isNativeLike(addr)`**: Checks if address is native token (native, 0x0, 0xeeee...)
- **`normalizeToNative(addr)`**: Converts native-like addresses to "native"
- Handles multiple native token representations

---

## Flow Diagrams

### 1. Get Quote Flow (Non-Custodial)

```
Client Request → JWT Auth → SwapController.getQuote
                                    ↓
                            GetQuoteUseCase.execute
                                    ↓
                            SwapDomainService.getQuote
                                    ↓
                         [Validates chain support]
                                    ↓
                        ThirdwebSwapAdapter.getQuote
                                    ↓
                        Bridge.Sell.quote (Thirdweb SDK)
                                    ↓
                         [Calculate exchange rate]
                         [Fetch token decimals]
                                    ↓
                            Return SwapQuote
                                    ↓
                         [Enrich with USD prices]
                         [PriceService via Bridge.tokens]
                                    ↓
                            Response to Client
```

**Key Points**:
- No transaction execution
- Returns quote with fees, rate, duration
- Includes USD pricing via `getTokenSpotUsdPrice()`

---

### 2. Prepare Swap Flow (Non-Custodial - Primary V1 Flow)

```
Client Request → JWT Auth → SwapController.getPreparedTx
                                    ↓
                            PrepareSwapUseCase.execute
                                    ↓
                            SwapDomainService.prepareSwap
                                    ↓
                         [Validates chain support]
                                    ↓
                        ThirdwebSwapAdapter.prepareSwap
                                    ↓
                        Bridge.Sell.prepare (Thirdweb SDK)
                                    ↓
                     [Returns prepared transaction bundle]
                     [Usually: approve + swap transactions]
                                    ↓
                         [Serialize BigInt values]
                                    ↓
                    Return prepared bundle to Client
                                    ↓
              [Client signs and sends transactions]
```

**Prepared Bundle Structure**:
```typescript
{
  steps: [{
    transactions: [{
      chainId: number,
      to: string,
      data: string,
      value: bigint,
      gasLimit?: string
    }]
  }],
  expiresAt: number,
  estimatedExecutionTimeMs: number
}
```

---

### 3. Execute Swap Flow (Engine-Enabled - ERC-4337)

```
Client Request → JWT Auth → SwapController.executeSwap
                                    ↓
                     [Check ENGINE_ENABLED=true]
                                    ↓
                            ExecuteSwapUseCase.execute
                                    ↓
                            SwapDomainService.prepareSwap
                                    ↓
                        ThirdwebSwapAdapter.prepareSwap
                                    ↓
                        Bridge.Sell.prepare (Thirdweb SDK)
                                    ↓
                    [Extract origin transactions from prepared]
                                    ↓
                    EngineExecutionAdapter.executeOriginTxs
                                    ↓
                         [EngineTokenManager.getToken]
                                    ↓
                    POST /smart-wallet/send-transaction
                         (Thirdweb Engine API)
                                    ↓
                         [Engine submits via ERC-4337]
                         [Session key signs on behalf of smart account]
                                    ↓
                    Return transaction hashes + userOpHash
```

**Requirements for Engine Execution**:
- `ENGINE_ENABLED=true`
- `ENGINE_URL` configured
- `ENGINE_ACCESS_TOKEN` or (`THIRDWEB_CLIENT_ID` + `THIRDWEB_SECRET_KEY`)
- `ADMIN_WALLET_ADDRESS` (session key signer)
- User's smart account address

---

### 4. Get Status Flow

```
Client Request → JWT Auth → SwapController.getStatus
                                    ↓
                         [Extract transactionHash from params]
                         [Extract chainId from query]
                                    ↓
                            GetSwapStatusUseCase.execute
                                    ↓
                            SwapDomainService.monitorStatus
                                    ↓
                        ThirdwebSwapAdapter.monitorTransaction
                                    ↓
                        Bridge.status (Thirdweb SDK)
                                    ↓
                         [Map to internal status enum]
                                    ↓
                            Return status to Client
```

**Status Values**: `PENDING`, `CONFIRMED`, `COMPLETED`, `FAILED`

---

### 5. Authentication Flow

```
Client Request with JWT → authMiddleware.verifyJwtMiddleware
                                    ↓
                         [Extract Bearer token from header]
                                    ↓
                    POST {AUTH_SERVICE_URL}/auth/validate
                         {token: string}
                                    ↓
                         [Auth service validates JWT]
                                    ↓
                         Returns {isValid, payload: {address, ...}}
                                    ↓
                         [Attach user to req.user]
                                    ↓
                            next() to route handler
```

**Protected Routes**: All `/swap/*` endpoints require JWT

---

## Key Interfaces and Implementations

### Domain Ports

#### `ISwapService` (Port)
```typescript
interface ISwapService {
  getQuote(swapRequest: SwapRequest): Promise<SwapQuote>;
  prepareSwap(swapRequest: SwapRequest): Promise<any>;
  executeSwap(swapRequest: SwapRequest): Promise<SwapResult>;
  monitorTransaction(transactionHash: string, chainId: number): Promise<string>;
}
```

**Implementation**: `ThirdwebSwapAdapter`

---

#### `IExecutionPort` (Port)
```typescript
interface IExecutionPort {
  executeOriginTxs(
    txs: PreparedOriginTx[],
    options: ExecutionOptions,
    meta: { sender: string }
  ): Promise<ExecutionResult[]>;
}
```

**Implementation**: `EngineExecutionAdapter`

**Types**:
```typescript
type ExecutionOptions = {
  type: "ERC4337";
  smartAccountAddress: string;
  signerAddress: string;
};

type PreparedOriginTx = {
  chainId: number;
  to: string;
  data: string;
  value?: string;
};

type ExecutionResult = {
  transactionHash: string;
  chainId: number;
  userOpHash?: string;
};
```

---

#### `IChainProvider` (Port)
```typescript
interface IChainProvider {
  getProvider(chainId: number): any;
  getSigner(chainId: number): any;
  getRpcUrl(chainId: number): string;
  isChainSupported(chainId: number): boolean;
}
```

**Implementation**: `ChainProviderAdapter`

---

#### `ISwapRepository` (Port)
```typescript
interface ISwapRepository {
  saveSwapRequest(swapRequest: SwapRequest): Promise<void>;
  getSwapHistory(userAddress: string): Promise<SwapResult[]>;
  saveSwapResult(swapResult: SwapResult): Promise<void>;
  updateTransactionStatus(transactionHash: string, status: string): Promise<void>;
}
```

**Implementation**: `SwapRepositoryAdapter` (in-memory, placeholder for DB)

---

### Domain Entities

#### `SwapRequest`
```typescript
class SwapRequest {
  private readonly _fromChainId: number;
  private readonly _toChainId: number;
  private readonly _fromToken: string;
  private readonly _toToken: string;
  private readonly _amount: bigint;
  private readonly _sender: string;
  private readonly _receiver: string;

  constructor(...) { /* validation */ }

  // Getters only (immutable)
  get fromChainId(): number;
  get toChainId(): number;
  get fromToken(): string;
  get toToken(): string;
  get amount(): bigint;
  get sender(): string;
  get receiver(): string;

  isNativeToken(): boolean;
  toLogString(): string;
}
```

**Validation**:
- Chain IDs must be > 0
- Token addresses must be non-empty
- Amount must be > 0
- Sender and receiver must be non-empty

---

#### `SwapQuote`
```typescript
class SwapQuote {
  private readonly _estimatedReceiveAmount: bigint;
  private readonly _bridgeFee: bigint;
  private readonly _gasFee: bigint;
  private readonly _exchangeRate: number;
  private readonly _estimatedDuration: number; // seconds

  constructor(...) {}

  get estimatedReceiveAmount(): bigint;
  get bridgeFee(): bigint;
  get gasFee(): bigint;
  get exchangeRate(): number;
  get estimatedDuration(): number;

  getTotalFees(): bigint; // bridgeFee + gasFee
}
```

---

#### `SwapTransaction`
```typescript
class SwapTransaction {
  private readonly _hash: string;
  private readonly _chainId: number;
  private readonly _to: string;
  private readonly _data: string;
  private readonly _value: bigint;
  private _status: TransactionStatus;

  updateStatus(status: TransactionStatus): void;
  isCompleted(): boolean;
  isFailed(): boolean;
}
```

---

#### `SwapResult`
```typescript
class SwapResult {
  private readonly _transactions: SwapTransaction[];
  private readonly _quote: SwapQuote;
  private readonly _startTime: Date;
  private _endTime?: Date;

  complete(): void; // Sets endTime
  getDuration(): number | undefined; // ms
  isCompleted(): boolean;
  hasFailed(): boolean;
}
```

---

### Domain Service

#### `SwapDomainService`
```typescript
class SwapDomainService {
  constructor(
    private readonly swapService: ISwapService,
    private readonly chainProvider: IChainProvider,
    private readonly swapRepository: ISwapRepository
  ) {}

  async validateSwapRequest(swapRequest: SwapRequest): Promise<void>;
  async getQuote(swapRequest: SwapRequest): Promise<SwapQuote>;
  async prepareSwap(swapRequest: SwapRequest): Promise<any>;
  async processSwap(swapRequest: SwapRequest): Promise<SwapResult>; // Disabled in V1
  async getSwapHistory(userAddress: string): Promise<SwapResult[]>;
  async monitorStatus(transactionHash: string, chainId: number): Promise<string>;
}
```

**Validation Logic**:
- Checks if both chains are supported
- Ensures from/to chains are different
- Logs validation status

---

## Error Handling Patterns

### 1. Adapter-Level Error Handling (ThirdwebSwapAdapter)

```typescript
try {
  // Call Thirdweb SDK
} catch (error: any) {
  const status = error?.statusCode || error?.status || error?.response?.status;
  const code = error?.code || error?.response?.data?.code;
  const correlationId = error?.correlationId || error?.response?.data?.correlationId;

  console.error("[ThirdwebSwapAdapter] Error:", {
    message: error?.message,
    status,
    code,
    correlationId
  });

  const detail = [
    error?.message,
    status ? `status=${status}` : undefined,
    code ? `code=${code}` : undefined,
    correlationId ? `correlationId=${correlationId}` : undefined
  ].filter(Boolean).join(", ");

  throw new Error(`Failed to get quote: ${detail}`);
}
```

**Key Points**:
- Extracts all available error context
- Logs structured error data
- Throws enriched error message

---

### 2. Controller-Level Error Handling

```typescript
try {
  // Execute use case
} catch (error) {
  console.error("[SwapController] Error:", error);
  return res.status(500).json({
    error: "Internal server error",
    message: error instanceof Error ? error.message : "Unknown error occurred"
  });
}
```

**Response Structure**:
```json
{
  "error": "Error category",
  "message": "Detailed error message"
}
```

---

### 3. Engine Token Refresh (401 Handling)

```typescript
if (res.status === 401) {
  this.tokenManager.invalidate();
  const retryToken = await this.tokenManager.getToken();
  const retry = await fetch(url, {
    headers: { Authorization: `Bearer ${retryToken}` },
    body: JSON.stringify(payload)
  });
  if (!retry.ok) {
    throw new Error(`Engine error (${retry.status}): ${await retry.text()}`);
  }
  return await retry.json();
}
```

**Features**:
- Automatically invalidates token on 401
- Fetches fresh token
- Retries request once
- Fails if retry also returns 401

---

### 4. Validation Errors (400 Bad Request)

```typescript
if (!fromChainId || !toChainId || !fromToken || !toToken || !amount || !sender) {
  return res.status(400).json({
    error: "Missing required parameters",
    requiredParams: ["fromChainId", "toChainId", "fromToken", "toToken", "amount", "sender"]
  });
}
```

**Features**:
- Lists missing required parameters
- Returns 400 status code
- Clear error messages

---

### 5. Domain Validation Errors

```typescript
class SwapRequest {
  private validateInputs(...) {
    if (!fromChainId || fromChainId <= 0) {
      throw new Error("Invalid fromChainId");
    }
    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
    // ...
  }
}
```

**Validation at Entity Level**:
- Ensures data integrity
- Throws descriptive errors
- Validates in constructor (fail-fast)

---

## Transaction Preparation and Execution

### Non-Custodial Flow (Primary V1)

#### 1. Client Requests Prepared Transactions

**Endpoint**: `POST /swap/tx`

**Request**:
```json
{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x...",
  "amount": "1000000000000000000",
  "sender": "0x..."
}
```

**Response**:
```json
{
  "success": true,
  "prepared": {
    "steps": [{
      "transactions": [
        {
          "chainId": 1,
          "to": "0x...",
          "data": "0x...",
          "value": "1000000000000000000",
          "gasLimit": "200000"
        }
      ]
    }],
    "expiresAt": 1234567890,
    "estimatedExecutionTimeMs": 30000
  }
}
```

#### 2. Client Signs and Sends Transactions

- Client receives prepared bundle
- Uses wallet (MetaMask, WalletConnect, etc.) to sign
- Sends signed transactions to blockchain
- Server has NO access to private keys

#### 3. Client Monitors Status

**Endpoint**: `GET /swap/status/:transactionHash?chainId=1`

**Response**:
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x...",
    "chainId": 1,
    "status": "COMPLETED",
    "userAddress": "0x..."
  }
}
```

---

### Engine-Enabled Flow (ERC-4337)

#### When to Use
- User has a smart account (ERC-4337)
- Backend wallet is session key signer
- `ENGINE_ENABLED=true`

#### 1. Client Requests Execution

**Endpoint**: `POST /swap/execute`

**Request**:
```json
{
  "fromChainId": 1,
  "toChainId": 137,
  "fromToken": "native",
  "toToken": "0x...",
  "amount": "1000000000000000000",
  "smartAccountAddress": "0x...",
  "receiver": "0x..."
}
```

**Response**:
```json
{
  "success": true,
  "transactionHashes": ["0x..."],
  "estimatedDuration": 30,
  "message": "Swap executed via Engine (ERC4337)"
}
```

#### 2. Server Executes via Engine

**Flow**:
1. Prepare swap with Thirdweb SDK
2. Extract origin transactions
3. Send to Engine with execution options:
   ```typescript
   {
     type: "ERC4337",
     smartAccountAddress: "0x...",
     signerAddress: process.env.ADMIN_WALLET_ADDRESS
   }
   ```
4. Engine submits via smart account
5. Returns transaction hashes

#### 3. Transaction Monitoring

Same as non-custodial flow - client monitors via `/swap/status/:hash`

---

### BigInt Serialization

**Problem**: JSON.stringify cannot handle BigInt

**Solution**: Custom replacer
```typescript
JSON.stringify(obj, (_k, v) =>
  typeof v === 'bigint' ? v.toString() : v
)
```

**Used In**:
- Controller response serialization
- Engine adapter payload preparation

---

## Dependencies Between Components

### Dependency Injection Container

**File**: `src/infrastructure/di/container.ts`

```
DIContainer (Singleton)
    │
    ├─ ThirdwebSwapAdapter ──────────┐
    │   └─ createThirdwebClient       │ (implements ISwapService)
    │                                  │
    ├─ ChainProviderAdapter ──────────┤
    │   └─ supportedChains config     │ (implements IChainProvider)
    │                                  │
    ├─ SwapRepositoryAdapter ─────────┤
    │   └─ in-memory storage          │ (implements ISwapRepository)
    │                                  │
    ├─ SwapDomainService ←────────────┘
    │   └─ (injected with above)
    │
    ├─ GetQuoteUseCase
    │   └─ SwapDomainService
    │
    ├─ PrepareSwapUseCase
    │   └─ SwapDomainService
    │
    ├─ ExecuteSwapUseCase
    │   ├─ SwapDomainService
    │   └─ EngineExecutionAdapter (if ENGINE_ENABLED)
    │       └─ EngineTokenManager
    │
    ├─ GetSwapHistoryUseCase
    │   └─ SwapDomainService
    │
    ├─ GetSwapStatusUseCase
    │   └─ SwapDomainService
    │
    └─ SwapController
        ├─ GetQuoteUseCase
        ├─ PrepareSwapUseCase
        ├─ ExecuteSwapUseCase
        ├─ GetSwapHistoryUseCase
        └─ GetSwapStatusUseCase
```

### Initialization Order

1. **Infrastructure Adapters** (no dependencies)
   - ThirdwebSwapAdapter
   - ChainProviderAdapter
   - SwapRepositoryAdapter

2. **Domain Service** (depends on adapters)
   - SwapDomainService

3. **Application Use Cases** (depend on domain service)
   - All use cases

4. **HTTP Controller** (depends on use cases)
   - SwapController

5. **Routes** (depend on controller)
   - swapRouter

6. **Express App** (depends on routes)
   - index.ts

---

### Inter-Component Communication

```
HTTP Request
    ↓
authMiddleware (validates JWT with auth-service)
    ↓
swapRouter (routes to controller method)
    ↓
SwapController (validates params, calls use case)
    ↓
UseCase (orchestrates business logic)
    ↓
SwapDomainService (domain logic + validation)
    ↓
ThirdwebSwapAdapter (external API calls)
    ↓
Thirdweb SDK (Bridge.Sell.quote/prepare/status)
    ↓
Response propagates back up
```

---

## Authentication and Authorization

### Authentication Flow

#### 1. JWT Verification Middleware

**File**: `src/middleware/authMiddleware.ts`

**Process**:
1. Extract `Authorization: Bearer <token>` header
2. POST to `{AUTH_SERVICE_URL}/auth/validate`
3. Receive validation response:
   ```typescript
   {
     isValid: boolean,
     payload: {
       address: string,
       // other claims
     }
   }
   ```
4. If valid: attach `req.user = payload` and call `next()`
5. If invalid: return 401 Unauthorized

**Error Responses**:
```json
// Missing token
{ "error": "Unauthorized", "message": "Missing authorization token" }

// Invalid token
{ "error": "Unauthorized", "message": "Invalid token" }

// Auth service error
{ "error": "Authentication error", "message": "Could not validate authentication" }
```

---

### Authorization Patterns

#### User-Scoped Resources

**Swap History**:
```typescript
// Controller checks that requested user matches authenticated user
if (req.params.userAddress !== req.user.address) {
  return res.status(403).json({
    error: "Forbidden",
    message: "You can only access your own swap history"
  });
}
```

#### Public Endpoints

- `GET /` - Service info (no auth)
- `GET /health` - Health check (no auth)
- `GET /engine/signer` - Engine signer address (CORS-enabled, no auth)

#### Protected Endpoints

- `POST /swap/quote` - JWT required
- `POST /swap/tx` - JWT required
- `POST /swap/execute` - JWT required
- `GET /swap/history` - JWT required
- `GET /swap/status/:hash` - JWT required

---

### Session Keys (Engine Mode)

When using Engine execution with ERC-4337:

1. **Smart Account**: User's smart account address
2. **Session Key**: Backend wallet (`ADMIN_WALLET_ADDRESS`)
3. **Permissions**: Session key authorized to act on behalf of smart account
4. **Flow**:
   - Client requests execution with `smartAccountAddress`
   - Server uses session key to sign via Engine
   - Engine submits user operation to bundler
   - Transaction executes from smart account

---

## Environment Variables

### Required Variables

#### `THIRDWEB_CLIENT_ID`
- **Purpose**: Thirdweb API client ID
- **Used By**: `ThirdwebSwapAdapter`, `thirdwebClient.ts`, `PriceService`
- **Example**: `"abc123..."`
- **Critical**: Service fails to start without this

---

### Optional Variables

#### `THIRDWEB_SECRET_KEY`
- **Purpose**: Thirdweb API secret key (enhanced rate limits)
- **Used By**: `ThirdwebSwapAdapter`, `thirdwebClient.ts`
- **Default**: None (public rate limits apply)

#### `AUTH_SERVICE_URL`
- **Purpose**: URL of authentication service
- **Used By**: `authMiddleware.ts`
- **Default**: `http://localhost:3001`
- **Example**: `https://auth.panoramablock.com`

#### `PORT` / `LIQUID_SWAP_PORT`
- **Purpose**: HTTP server port
- **Used By**: `index.ts`
- **Default**: `3002`

#### `NODE_ENV`
- **Purpose**: Environment mode
- **Used By**: Error handlers, logging
- **Values**: `development`, `production`, `test`
- **Default**: `development`

#### `DEBUG`
- **Purpose**: Enable verbose logging
- **Used By**: All adapters, controllers
- **Values**: `true`, `false`
- **Default**: `false`

---

### Engine-Specific Variables (Optional)

#### `ENGINE_ENABLED`
- **Purpose**: Enable server-side execution via Engine
- **Used By**: `DIContainer`, `SwapController`
- **Values**: `true`, `false`
- **Default**: `false`

#### `ENGINE_URL`
- **Purpose**: Thirdweb Engine API URL
- **Used By**: `EngineExecutionAdapter`
- **Required If**: `ENGINE_ENABLED=true`
- **Example**: `https://engine.example.com`

#### `ENGINE_ACCESS_TOKEN`
- **Purpose**: Static Engine access token
- **Used By**: `EngineTokenManager`
- **Alternative**: Use `THIRDWEB_CLIENT_ID` + `THIRDWEB_SECRET_KEY` for dynamic login

#### `ENGINE_API_TOKEN`
- **Purpose**: Alias for `ENGINE_ACCESS_TOKEN`
- **Used By**: `EngineTokenManager`

#### `ADMIN_WALLET_ADDRESS`
- **Purpose**: Session key signer address (backend wallet)
- **Used By**: `ExecuteSwapUseCase`, `index.ts`
- **Required If**: `ENGINE_ENABLED=true`
- **Example**: `"0x1234..."`

#### `ENGINE_SESSION_SIGNER_ADDRESS`
- **Purpose**: Alias for `ADMIN_WALLET_ADDRESS`
- **Used By**: `index.ts` (GET /engine/signer endpoint)

---

### Chain RPC URLs (Optional)

Used by `ChainProviderAdapter` with fallback defaults:

- `ETHEREUM_RPC_URL` (default: `https://eth.llamarpc.com`)
- `POLYGON_RPC_URL` (default: `https://polygon.llamarpc.com`)
- `BSC_RPC_URL` (default: `https://bsc.llamarpc.com`)
- `BASE_RPC_URL` (default: `https://base.llamarpc.com`)
- `OPTIMISM_RPC_URL` (default: `https://optimism.llamarpc.com`)
- `ARBITRUM_RPC_URL` (default: `https://arbitrum.llamarpc.com`)
- `AVALANCHE_RPC_URL` (default: `https://api.avax.network/ext/bc/C/rpc`)

---

### SSL Configuration (Optional)

#### `FULLCHAIN`
- **Purpose**: Path to SSL certificate chain
- **Default**: `/etc/letsencrypt/live/api.panoramablock.com/fullchain.pem`

#### `PRIVKEY`
- **Purpose**: Path to SSL private key
- **Default**: `/etc/letsencrypt/live/api.panoramablock.com/privkey.pem`

**Behavior**: Server uses HTTPS if both files exist, otherwise falls back to HTTP

---

### Example `.env` File

```env
# Required
THIRDWEB_CLIENT_ID=your_client_id_here

# Optional but Recommended
THIRDWEB_SECRET_KEY=your_secret_key_here
AUTH_SERVICE_URL=http://localhost:3001
PORT=3002
NODE_ENV=development
DEBUG=false

# Engine (Optional)
ENGINE_ENABLED=false
ENGINE_URL=https://engine.example.com
ENGINE_ACCESS_TOKEN=your_token_here
ADMIN_WALLET_ADDRESS=0x...

# Chain RPCs (Optional - defaults provided)
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon.llamarpc.com

# SSL (Optional)
FULLCHAIN=/path/to/fullchain.pem
PRIVKEY=/path/to/privkey.pem
```

---

## Key Implementation Details

### 1. Exchange Rate Calculation

**Problem**: Different tokens have different decimals

**Solution**: Decimals-aware rate calculation
```typescript
const fromDecimals = await getTokenDecimals(fromChainId, fromToken);
const toDecimals = await getTokenDecimals(toChainId, toToken);

const SCALE = 12n; // precision
const num = destAmount * (10n ** (BigInt(fromDecimals) + SCALE));
const den = originAmount * (10n ** BigInt(toDecimals));
const scaledRate = den === 0n ? 0n : (num / den);
const exchangeRate = Number(scaledRate) / 10 ** Number(SCALE);
```

**Result**: Normalized rate that accounts for decimal differences

---

### 2. Native Token Handling

**Challenge**: Native tokens have multiple representations
- "native"
- "0x0000000000000000000000000000000000000000"
- "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

**Solution**: Normalize all to "native" or `NATIVE_TOKEN_ADDRESS`
```typescript
// When calling Thirdweb API
const tokenAddr = isNativeLike(token) ? NATIVE_TOKEN_ADDRESS : token;

// When storing/comparing
const normalized = normalizeToNative(token);
```

---

### 3. USD Price Enrichment

**PriceService** (`src/application/services/price.service.ts`):
```typescript
async function getTokenSpotUsdPrice(chainId: number, token: string): Promise<number | null> {
  const key = `spot:${chainId}:${token.toLowerCase()}`;

  // Check cache (20s TTL)
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 20000) return cached.v;

  // Fetch from Thirdweb
  const tokens = await Bridge.tokens({ client, chainId, tokenAddress: token });
  const usd = tokens?.[0]?.priceUsd;

  if (typeof usd === 'number' && usd > 0) {
    cache.set(key, { v: usd, at: Date.now() });
    return usd;
  }

  return null;
}
```

**Features**:
- 20-second cache
- Fallback to null if unavailable
- Used in GetQuoteUseCase to enrich response

---

### 4. Transaction Bundle Extraction

**Challenge**: Prepared response structure varies

**Solution**: Handle multiple formats
```typescript
// Try direct transactions array
if (Array.isArray(prepared?.transactions)) {
  txs.push(...prepared.transactions);
}

// Try steps array
if (!txs.length && Array.isArray(prepared?.steps)) {
  for (const step of prepared.steps) {
    if (Array.isArray(step?.transactions)) {
      txs.push(...step.transactions);
    }
  }
}

if (!txs.length) {
  throw new Error("No origin transactions found");
}
```

---

## Summary

### Strengths

1. **Clean Architecture**: Clear separation of concerns across layers
2. **Flexibility**: Supports both non-custodial and Engine-based flows
3. **Type Safety**: Strong TypeScript typing throughout
4. **Error Handling**: Comprehensive error extraction and logging
5. **Immutability**: Domain entities use private readonly fields
6. **Testability**: Ports/adapters pattern enables easy mocking
7. **BigInt Handling**: Proper wei value management without precision loss

### V1 Non-Custodial Focus

- Primary flow: client signs and sends prepared transactions
- Server has no access to private keys
- `prepareSwap()` is the core method
- `executeSwap()` disabled by default

### Engine Integration (Optional)

- ERC-4337 smart account support
- Session key execution via backend wallet
- Token refresh on expiration
- Multiple endpoint fallbacks

### Security Considerations

1. **JWT Authentication**: All swap endpoints protected
2. **Non-Custodial by Default**: Server never handles private keys
3. **User-Scoped Resources**: Users can only access their own data
4. **SSL Support**: HTTPS enabled when certificates available
5. **Internal Auth Communication**: SSL verification disabled for auth-service calls

---

## Future Improvements

1. **Database Integration**: Replace in-memory SwapRepositoryAdapter
2. **WebSocket Status Updates**: Real-time transaction monitoring
3. **Rate Limiting**: Prevent abuse of endpoints
4. **Metrics/Monitoring**: Prometheus/Grafana integration
5. **Unit Tests**: Comprehensive test coverage
6. **API Documentation**: OpenAPI/Swagger spec
7. **Multi-Route Support**: Compare quotes from multiple DEX aggregators
8. **Gas Optimization**: Real-time gas fee estimation

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Service Version**: 1.0.0
**Architecture**: Hexagonal (Ports and Adapters)
