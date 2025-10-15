# Uniswap Trading API - Comprehensive Audit Report

**Date:** October 14, 2025
**API Version:** v1
**Base URLs:**
- Production: `https://trade-api.gateway.uniswap.org/v1`
- Beta: `https://beta.trade-api.gateway.uniswap.org/v1`

**Documentation:** https://api-docs.uniswap.org/
**OpenAPI Spec:** https://trade-api.gateway.uniswap.org/v1/api.json

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Complete API Reference](#complete-api-reference)
3. [Side-by-Side Comparison](#side-by-side-comparison)
4. [Critical Issues & Gaps](#critical-issues--gaps)
5. [Required Fixes](#required-fixes)
6. [Recommendations](#recommendations)

---

## Executive Summary

### Overview
This audit compares the official Uniswap Trading API documentation against our implementation in the `liquid-swap-service`. The analysis covers all endpoints, request/response schemas, error handling, and routing logic.

### Key Findings

**Total Endpoints Documented:** 21
**Endpoints Implemented:** 5
**Missing Endpoints:** 16

**Critical Issues Found:** 8
**Important Issues Found:** 12
**Nice-to-Have Improvements:** 7

### Implementation Status

| Category | Status | Count |
|----------|--------|-------|
| ✅ Correctly Implemented | Good | 3 |
| ⚠️ Partial Implementation | Warning | 4 |
| ❌ Missing/Incorrect | Critical | 14 |

### Top Priority Fixes

1. **P0 - CRITICAL:** Base URL is incorrect (using `/v2` instead of `/v1`)
2. **P0 - CRITICAL:** Quote request schema missing required `swapper` field
3. **P0 - CRITICAL:** Quote request uses wrong field names (`tokenIn/Out` vs `tokenInChainId/tokenOutChainId`)
4. **P0 - CRITICAL:** Missing routing types (WRAP, UNWRAP, LIMIT_ORDER, DUTCH_LIMIT)
5. **P1 - IMPORTANT:** Order status enum missing `unverified` value
6. **P1 - IMPORTANT:** Missing 16 endpoints (liquidity, batch swaps, etc.)

---

## Complete API Reference

### Authentication

**Required Header:**
```
x-api-key: YOUR_API_KEY
```

**Rate Limits:**
- Default: 12 requests per second
- Higher rates available upon request

**Error Codes:**
- `400`: Request Validation Error
- `401`: Unauthorized (invalid API key)
- `404`: Resource Not Found
- `419`: Rate Limited (HTTP 429 equivalent)
- `500`: Internal Server Error
- `504`: Request Timeout

---

### 1. Swapping Endpoints

#### 1.1 POST /quote

**Purpose:** Get a swap quote with routing information

**Request Headers:**
- `x-api-key` (required)
- `x-universal-router-version` (optional, default: '1.2', can be '2.0')

**Request Body Schema:**
```typescript
{
  // REQUIRED FIELDS
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT',              // Trade type
  amount: string,                                     // Token quantity in base units
  tokenInChainId: number,                            // Source chain ID
  tokenOutChainId: number,                           // Destination chain ID
  tokenIn: string,                                   // Input token address
  tokenOut: string,                                  // Output token address
  swapper: string,                                   // Sender wallet address

  // OPTIONAL FIELDS
  slippageTolerance?: string,                        // Slippage as decimal (e.g., "0.5" for 0.5%)
  autoSlippage?: {
    enabled: boolean,
    maxSlippageTolerance?: string,
    minSlippageTolerance?: string
  },
  routingPreference?: 'BEST_PRICE' | 'FASTEST',      // Routing preference
  protocols?: Array<'V2' | 'V3' | 'V4' | 'UNISWAPX_V2' | 'UNISWAPX_V3'>,
  generatePermitAsTransaction?: boolean,              // Generate permit as transaction
  hooksOptions?: object,                             // V4 hooks options
  spreadOptimization?: boolean,                      // Enable spread optimization
  urgency?: 'urgent' | 'normal' | 'low',            // Transaction urgency
  permitAmount?: string                              // Permit amount override
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,                                 // Unique request ID
  routing: 'CLASSIC' | 'DUTCH_V2' | 'DUTCH_V3' | 'BRIDGE' |
           'PRIORITY' | 'WRAP' | 'UNWRAP' | 'LIMIT_ORDER' | 'DUTCH_LIMIT',
  quote: ClassicQuote | DutchQuoteV2 | DutchQuoteV3 | BridgeQuote |
         PriorityQuote | WrapUnwrapQuote,
  permitData: {                                      // Permit2 signature data (nullable)
    domain: {
      name: string,
      chainId: number,
      verifyingContract: string
    },
    types: Record<string, Array<{name: string, type: string}>>,
    values: object
  } | null,
  permitTransaction?: {                              // Traditional permit transaction
    to: string,
    data: string,
    value: string,
    chainId: number,
    gasLimit?: string,
    maxFeePerGas?: string,
    maxPriorityFeePerGas?: string
  },
  permitGasFee?: string                             // Gas fee for permit (wei)
}
```

**ClassicQuote Schema:**
```typescript
{
  input: {
    token: string,
    amount: string
  },
  output: {
    token: string,
    amount: string
  },
  swapper: string,
  chainId: number,
  slippage: string,
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT',
  gasFee?: string,                                   // Gas fee in wei
  gasFeeUSD?: string,                                // Gas fee in USD
  gasFeeQuote?: string,                              // Gas fee in quote currency
  route: Array<Array<V2Pool | V3Pool | V4Pool>>,    // Route path
  portionBips?: number,                              // Fee portion in bips
  portionAmount?: string,                            // Fee amount
  portionRecipient?: string,                         // Fee recipient address
  routeString?: string,                              // Human-readable route
  quoteId?: string,                                  // Quote ID for tracking
  gasUseEstimate?: string,                           // Gas units estimate
  blockNumber?: string,                              // Block number
  gasPrice?: string,                                 // Gas price
  maxFeePerGas?: string,                             // EIP-1559 max fee
  maxPriorityFeePerGas?: string,                     // EIP-1559 priority fee
  txFailureReasons?: Array<string>,                  // Simulation failure reasons
  priceImpact?: number,                              // Price impact (0-100)
  aggregatedOutputs?: Array<{                        // For multi-output swaps
    token: string,
    amount: string
  }>
}
```

**DutchQuoteV2 Schema:**
```typescript
{
  encodedOrder: string,                              // Encoded order data
  orderId: string,                                   // Unique order ID
  orderInfo: {
    reactor: string,                                 // Reactor contract
    swapper: string,                                 // Swapper address
    nonce: string,                                   // Order nonce
    deadline: number,                                // Deadline timestamp
    input: {
      token: string,
      amount: string
    },
    outputs: Array<{
      token: string,
      startAmount: string,                           // Decay start amount
      endAmount: string,                             // Decay end amount
      recipient: string
    }>,
    decayStartTime: number,
    decayEndTime: number
  },
  portionBips?: number,
  portionAmount?: string,
  portionRecipient?: string,
  quoteId?: string,
  slippageTolerance?: string,
  deadlineBufferSecs?: number,
  classicGasUseEstimateUSD?: string,                // Classic routing gas estimate
  aggregatedOutputs?: Array<object>
}
```

**Error Responses:**
- `400`: Invalid request parameters
- `401`: Unauthorized (invalid API key)
- `404`: No quotes available / No route found
- `419`: Rate limited
- `500`: Internal server error
- `504`: Request timeout

---

#### 1.2 POST /check_approval

**Purpose:** Check if token approval is needed (Permit2)

**Request Body Schema:**
```typescript
{
  // REQUIRED FIELDS
  walletAddress: string,                             // Wallet address
  token: string,                                     // Token contract address
  amount: string,                                    // Amount in base units
  chainId: number,                                   // Chain ID

  // OPTIONAL FIELDS
  urgency?: 'urgent' | 'normal' | 'low',            // Transaction urgency
  includeGasInfo?: boolean,                          // Include gas estimates (deprecated)
  tokenOut?: string,                                 // Output token address
  tokenOutChainId?: number                           // Output token chain ID
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,
  approval: {                                        // Approval transaction (null if not needed)
    to: string,
    data: string,
    value: string,
    chainId: number,
    gasLimit?: string,
    maxFeePerGas?: string,
    maxPriorityFeePerGas?: string
  } | null,
  cancel: {                                          // Cancel transaction (for tokens requiring reset)
    to: string,
    data: string,
    value: string,
    chainId: number,
    gasLimit?: string,
    maxFeePerGas?: string,
    maxPriorityFeePerGas?: string
  } | null,
  gasFee?: string,                                   // Approval gas fee
  cancelGasFee?: string                              // Cancel gas fee
}
```

**Error Responses:**
- `400`: Request validation error
- `401`: Unauthorized
- `404`: Token allowance not found / Gas info not found
- `419`: Rate limited
- `500`: Internal server error
- `504`: Request timeout

---

#### 1.3 POST /swap

**Purpose:** Create swap transaction calldata (for CLASSIC routing)

**Request Body Schema:**
```typescript
{
  // REQUIRED FIELDS
  quote: ClassicQuote | WrapUnwrapQuote | BridgeQuote, // Quote from /quote endpoint

  // OPTIONAL FIELDS (conditionally required)
  signature?: string,                                // Signed permit (if permitData was returned)
  permitData?: {                                     // Permit data (if permitData was returned)
    domain: object,
    types: object,
    values: object
  },
  refreshGasPrice?: boolean,                         // Re-fetch gas price (default: false)
  simulateTransaction?: boolean,                     // Simulate transaction (default: false)
  safetyMode?: 'SAFE' | 'UNSAFE',                   // Safety mode
  deadline?: number,                                 // Transaction deadline
  urgency?: 'urgent' | 'normal' | 'low',            // Transaction urgency
  includeGasInfo?: boolean                           // Deprecated, use refreshGasPrice
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,
  swap: {                                            // Transaction to sign and send
    to: string,                                      // Contract address
    data: string,                                    // Calldata
    value: string,                                   // ETH value (wei)
    chainId: number,
    gasLimit?: string,
    maxFeePerGas?: string,
    maxPriorityFeePerGas?: string
  },
  gasFee?: string                                    // Gas fee estimate
}
```

**Error Responses:**
- `400`: Request validation error
- `401`: Unauthorized / Fee not enabled
- `404`: No quotes available / Gas fee not available
- `419`: Rate limited
- `500`: Internal server error
- `504`: Request timeout

---

#### 1.4 POST /order

**Purpose:** Submit UniswapX gasless order (for DUTCH_V2, DUTCH_V3, PRIORITY routing)

**Request Body Schema:**
```typescript
{
  // REQUIRED FIELDS
  signature: string,                                 // Signed permit
  quote: DutchQuoteV2 | DutchQuoteV3 | PriorityQuote, // Quote from /quote endpoint
  routing: 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY'     // Routing type
}
```

**Response Schema (201 Created):**
```typescript
{
  requestId: string,
  orderId: string,                                   // Unique order ID
  orderStatus: 'open' | 'expired' | 'error' | 'cancelled' |
               'filled' | 'unverified' | 'insufficient-funds'
}
```

**Error Responses:**
- `400`: Request validation error
- `401`: Unauthorized
- `419`: Rate limited
- `500`: Internal server error
- `504`: Request timeout

---

#### 1.5 GET /orders

**Purpose:** Get UniswapX order status

**Query Parameters:**
```typescript
{
  // AT LEAST ONE REQUIRED
  orderId?: string,                                  // Single order ID
  orderIds?: string[],                               // Multiple order IDs (comma-separated)
  orderStatus?: 'open' | 'expired' | 'error' | 'cancelled' |
                'filled' | 'unverified' | 'insufficient-funds',
  swapper?: string,                                  // Swapper address filter
  filler?: string,                                   // Filler address filter

  // OPTIONAL
  orderType?: string,                                // Order type filter
  limit?: number,                                    // Results limit
  sortKey?: string,                                  // Sort field
  sort?: 'asc' | 'desc',                            // Sort direction
  cursor?: string                                    // Pagination cursor
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,
  orders: Array<{
    type: string,                                    // Order type
    encodedOrder: string,
    signature: string,
    nonce: string,
    orderStatus: 'open' | 'expired' | 'error' | 'cancelled' |
                 'filled' | 'unverified' | 'insufficient-funds',
    orderId: string,
    chainId: number,
    quoteId?: string,
    swapper: string,
    txHash?: string,                                 // Fill transaction hash
    input: {
      token: string,
      amount: string
    },
    outputs: Array<{
      token: string,
      amount: string,
      recipient: string
    }>,
    settledAmounts?: Array<{
      token: string,
      amount: string
    }>,
    cosignature?: string,
    cosignerData?: object
  }>,
  cursor?: string                                    // Pagination cursor
}
```

**Error Responses:**
- `400`: Request validation error
- `404`: Orders not found
- `419`: Rate limited
- `500`: Internal server error
- `504`: Request timeout

---

#### 1.6 GET /swaps

**Purpose:** Get swap/bridge transaction status

**Query Parameters:**
```typescript
{
  // REQUIRED
  txHashes: string[],                                // Transaction hashes (comma-separated)
  chainId: number                                    // Chain ID
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,
  swaps: Array<{
    txHash: string,
    status: string,
    blockNumber?: number,
    confirmations?: number
  }>
}
```

---

#### 1.7 POST /swap_5792

**Purpose:** Create EIP-5792 batch swap calldata

**Request Body Schema:**
```typescript
{
  // REQUIRED
  quote: ClassicQuote | WrapUnwrapQuote | BridgeQuote,

  // OPTIONAL
  permitData?: object,
  deadline?: number,
  urgency?: 'urgent' | 'normal' | 'low'
}
```

**Response Schema (200 OK):**
```typescript
{
  requestId: string,
  from: string,                                      // Wallet address
  chainId: number,
  calls: Array<{                                     // Batch transactions
    to: string,
    data: string,
    value: string
  }>,
  gasFee?: string
}
```

---

#### 1.8 POST /swap_7702

**Purpose:** Create EIP-7702 smart wallet swap calldata

**Request Body Schema:** (Similar to /swap_5792)

---

#### 1.9 POST /send

**Purpose:** Create token send transaction

**Request Body Schema:**
```typescript
{
  sender: string,
  recipient: string,
  token: string,
  amount: string,
  chainId: number
}
```

---

#### 1.10 GET /swappable_tokens

**Purpose:** Get bridgeable tokens for a given token

**Query Parameters:**
```typescript
{
  tokenIn: string,                                   // Token address
  chainId: number                                    // Chain ID
}
```

---

### 2. Liquidity Endpoints

#### 2.1 POST /lp/approve
**Purpose:** Check LP token approvals

#### 2.2 POST /lp/create
**Purpose:** Create liquidity position

#### 2.3 POST /lp/increase
**Purpose:** Increase liquidity position

#### 2.4 POST /lp/decrease
**Purpose:** Decrease liquidity position

#### 2.5 POST /lp/claim
**Purpose:** Claim LP fees

#### 2.6 POST /lp/migrate
**Purpose:** Migrate LP position between versions

#### 2.7 POST /lp/claim_rewards
**Purpose:** Claim LP rewards

---

### 3. Other Endpoints

#### 3.1 POST /limit_order_quote
**Purpose:** Get limit order quote

#### 3.2 POST /wallet/encode_7702
**Purpose:** Encode wallet transactions for smart wallets

#### 3.3 POST /wallet/check_delegation
**Purpose:** Check wallet delegation status

#### 3.4 POST /indicative_quote (DEPRECATED)
**Purpose:** Get fast indicative quote (use /quote with routingPreference=FASTEST)

---

## Side-by-Side Comparison

### Base URL

| **Aspect** | **Official Documentation** | **Our Implementation** | **Status** |
|------------|---------------------------|------------------------|------------|
| Production URL | `https://trade-api.gateway.uniswap.org/v1` | `https://api.gateway.uniswap.org/v2` | ❌ **WRONG** |
| Beta URL | `https://beta.trade-api.gateway.uniswap.org/v1` | Not implemented | ⚠️ Missing |
| Version | `/v1` | `/v2` | ❌ **WRONG** |

**Issue:** Our base URL is completely incorrect - wrong subdomain and wrong version.

---

### Supported Chains

| **Chain** | **Chain ID** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|--------------|-------------------|------------------------|------------|
| Ethereum | 1 | ✅ | ✅ | ✅ |
| OP Mainnet | 10 | ✅ | ✅ | ✅ |
| BNB Chain | 56 | ✅ | ✅ | ✅ |
| Unichain | 130 | ✅ | ✅ | ✅ |
| Polygon | 137 | ✅ | ✅ | ✅ |
| zkSync | 324 | ✅ | ✅ | ✅ |
| World Chain | 480 | ✅ | ✅ | ✅ |
| Soneium | 1868 | ✅ | ❌ 1946 | ❌ **WRONG** |
| Base | 8453 | ✅ | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ | ✅ |
| Celo | 42220 | ✅ | ❌ Missing | ⚠️ Missing |
| Avalanche | 43114 | ✅ | ✅ | ✅ |
| Blast | 81457 | ✅ | ✅ | ✅ |
| Zora | 7777777 | ✅ | ✅ | ✅ |
| Ink | 57073 | ❌ Not in docs | ✅ In our code | ⚠️ Unclear |

**Issues:**
1. Soneium chain ID is wrong (1868 in docs, 1946 in our code)
2. Missing Celo (42220)
3. Ink (57073) is in our code but not in official docs

---

### Routing Types

| **Routing** | **Official Docs** | **Our Implementation** | **Status** |
|-------------|-------------------|------------------------|------------|
| CLASSIC | ✅ | ✅ | ✅ |
| DUTCH_V2 | ✅ | ✅ | ✅ |
| DUTCH_V3 | ✅ | ✅ | ✅ |
| BRIDGE | ✅ | ✅ | ✅ |
| PRIORITY | ✅ | ✅ | ✅ |
| WRAP | ✅ | ❌ Missing | ❌ **MISSING** |
| UNWRAP | ✅ | ❌ Missing | ❌ **MISSING** |
| LIMIT_ORDER | ✅ | ❌ Missing | ❌ **MISSING** |
| DUTCH_LIMIT | ✅ | ❌ Missing | ❌ **MISSING** |

**Issues:**
- Missing 4 routing types: WRAP, UNWRAP, LIMIT_ORDER, DUTCH_LIMIT

---

### Quote Endpoint (/quote)

#### Request Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| **type** | ✅ Required | ✅ Required | ✅ |
| **amount** | ✅ Required | ✅ Required | ✅ |
| **tokenInChainId** | ✅ Required | ❌ Missing | ❌ **MISSING** |
| **tokenOutChainId** | ✅ Required | ❌ Missing | ❌ **MISSING** |
| **tokenIn** | ✅ Required (address) | ✅ Has (but used wrongly) | ⚠️ **WRONG USAGE** |
| **tokenOut** | ✅ Required (address) | ✅ Has (but used wrongly) | ⚠️ **WRONG USAGE** |
| **swapper** | ✅ Required | ❌ Using "recipient" | ❌ **WRONG FIELD** |
| recipient | ❌ Not in docs | ✅ Using this | ❌ **EXTRA FIELD** |
| slippageTolerance | ✅ Optional | ✅ "slippage" | ⚠️ **WRONG NAME** |
| autoSlippage | ✅ Optional | ❌ Missing | ⚠️ Missing |
| routingPreference | ✅ Optional | ❌ Missing | ⚠️ Missing |
| protocols | ✅ Optional | ❌ Missing | ⚠️ Missing |
| generatePermitAsTransaction | ✅ Optional | ❌ Missing | ⚠️ Missing |
| hooksOptions | ✅ Optional | ❌ Missing | ⚠️ Missing |
| spreadOptimization | ✅ Optional | ❌ Missing | ⚠️ Missing |
| urgency | ✅ Optional | ❌ Missing | ⚠️ Missing |
| permitAmount | ✅ Optional | ❌ Missing | ⚠️ Missing |
| chainId | ❌ Not in docs | ✅ Using this | ❌ **WRONG** |
| enableUniversalRouter | ❌ Not in docs | ✅ Has this | ❌ **WRONG** |

**Critical Issues:**
1. We're using `chainId` instead of `tokenInChainId` and `tokenOutChainId`
2. We're using `recipient` instead of `swapper`
3. We're using `slippage` instead of `slippageTolerance`
4. Missing cross-chain support (separate chain IDs for input/output)
5. Missing many optional but important fields

#### Response Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| requestId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| routing | ✅ Required | ✅ Has | ✅ |
| quote | ✅ Required (complex) | ✅ Has (simplified) | ⚠️ **INCOMPLETE** |
| permitData | ✅ Required (nullable) | ✅ Has | ✅ |
| permitTransaction | ✅ Optional | ❌ Missing | ⚠️ Missing |
| permitGasFee | ✅ Optional | ❌ Missing | ⚠️ Missing |

**Quote Object Comparison:**

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| amount | ✅ In output object | ✅ Has | ✅ |
| amountDecimals | ❌ Not in docs | ✅ Has | ⚠️ Extra field |
| priceImpact | ✅ Has (in ClassicQuote) | ✅ Has | ✅ |
| slippage | ❌ Not as standalone | ✅ Has | ⚠️ Different structure |
| gasFee | ✅ Has | ✅ Has | ✅ |
| gasUseEstimate | ✅ Has | ✅ Has | ✅ |
| route | ✅ Has (Array<Array<Pool>>) | ✅ Has (simplified) | ⚠️ **SIMPLIFIED** |
| orderInfo | ✅ Has (for UniswapX) | ✅ Has | ✅ |
| input | ✅ Has | ❌ Missing | ❌ **MISSING** |
| output | ✅ Has | ❌ Missing | ❌ **MISSING** |
| swapper | ✅ Has | ❌ Missing | ❌ **MISSING** |
| tradeType | ✅ Has | ❌ Missing | ❌ **MISSING** |
| gasFeeUSD | ✅ Has | ❌ Missing | ⚠️ Missing |
| gasFeeQuote | ✅ Has | ❌ Missing | ⚠️ Missing |
| portionBips | ✅ Has | ❌ Missing | ⚠️ Missing |
| portionAmount | ✅ Has | ❌ Missing | ⚠️ Missing |
| portionRecipient | ✅ Has | ❌ Missing | ⚠️ Missing |
| routeString | ✅ Has | ❌ Missing | ⚠️ Missing |
| quoteId | ✅ Has | ❌ Missing | ⚠️ Missing |
| blockNumber | ✅ Has | ❌ Missing | ⚠️ Missing |
| gasPrice | ✅ Has | ❌ Missing | ⚠️ Missing |
| maxFeePerGas | ✅ Has | ❌ Missing | ⚠️ Missing |
| maxPriorityFeePerGas | ✅ Has | ❌ Missing | ⚠️ Missing |
| txFailureReasons | ✅ Has | ❌ Missing | ⚠️ Missing |
| aggregatedOutputs | ✅ Has | ❌ Missing | ⚠️ Missing |

---

### Check Approval Endpoint (/check_approval)

#### Request Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| walletAddress | ✅ Required | ✅ Has | ✅ |
| token | ✅ Required | ✅ Has | ✅ |
| amount | ✅ Required | ✅ Has | ✅ |
| chainId | ✅ Required | ✅ Has | ✅ |
| urgency | ✅ Optional | ❌ Missing | ⚠️ Missing |
| includeGasInfo | ✅ Optional (deprecated) | ❌ Missing | ⚠️ Missing |
| tokenOut | ✅ Optional | ❌ Missing | ⚠️ Missing |
| tokenOutChainId | ✅ Optional | ❌ Missing | ⚠️ Missing |

#### Response Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| requestId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| approval | ✅ Required (nullable) | ✅ Has (nested) | ⚠️ **DIFFERENT STRUCTURE** |
| cancel | ✅ Required (nullable) | ❌ Missing | ❌ **MISSING** |
| gasFee | ✅ Optional | ❌ Missing | ⚠️ Missing |
| cancelGasFee | ✅ Optional | ❌ Missing | ⚠️ Missing |

**Our Current Structure:**
```typescript
{
  approval: {
    isRequired: boolean,        // Not in official docs
    permitData?: object,
    approvalTransaction?: object
  }
}
```

**Official Structure:**
```typescript
{
  requestId: string,
  approval: TransactionRequest | null,  // null if not needed
  cancel: TransactionRequest | null,    // for tokens requiring reset
  gasFee?: string,
  cancelGasFee?: string
}
```

**Issues:**
1. We have `approval.isRequired` field which doesn't exist in docs
2. We nest `permitData` inside approval, but docs have separate structure
3. Missing `requestId` field
4. Missing `cancel` transaction field
5. Missing gas fee fields

---

### Swap Endpoint (/swap)

#### Request Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| quote | ✅ Required (ClassicQuote) | ❌ Sending individual fields | ❌ **WRONG** |
| signature | ✅ Optional | ❌ Missing | ⚠️ Missing |
| permitData | ✅ Optional | ✅ Has | ✅ |
| refreshGasPrice | ✅ Optional | ❌ Missing | ⚠️ Missing |
| simulateTransaction | ✅ Optional | ❌ Missing | ⚠️ Missing |
| safetyMode | ✅ Optional | ❌ Missing | ⚠️ Missing |
| deadline | ✅ Optional | ❌ Missing | ⚠️ Missing |
| urgency | ✅ Optional | ❌ Missing | ⚠️ Missing |
| tokenIn | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| tokenOut | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| amount | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| type | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| recipient | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| slippage | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| chainId | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |

**Critical Issue:**
We're sending individual swap parameters instead of the `quote` object returned from `/quote` endpoint. The official API expects the ENTIRE quote object to be sent back, not individual fields.

#### Response Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| requestId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| swap | ✅ Required (TransactionRequest) | ✅ Has (as transactionRequest) | ⚠️ **DIFFERENT NAME** |
| gasFee | ✅ Optional | ❌ Missing | ⚠️ Missing |

---

### Order Endpoint (/order)

#### Request Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| signature | ✅ Required | ❌ Missing | ❌ **MISSING** |
| quote | ✅ Required (Dutch/Priority) | ❌ Sending individual fields | ❌ **WRONG** |
| routing | ✅ Required | ❌ Missing | ❌ **MISSING** |
| tokenIn | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| tokenOut | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| amount | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| type | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| swapper | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| slippage | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |
| chainId | ❌ Not in docs | ✅ Sending | ❌ **WRONG** |

**Critical Issue:**
Same as /swap - we're sending individual parameters instead of the quote object. The official API expects:
```typescript
{
  signature: string,
  quote: DutchQuoteV2 | DutchQuoteV3 | PriorityQuote,
  routing: 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY'
}
```

#### Response Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| requestId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| orderId | ✅ Required | ✅ Has | ✅ |
| orderStatus | ✅ Required | ❌ Missing | ❌ **MISSING** |
| orderHash | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |
| signature | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |
| encodedOrder | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |
| orderInfo | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |

---

### Order Status Endpoint (/orders)

#### Request (Query Params) Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| orderId | ✅ Optional | ✅ Has | ✅ |
| orderIds | ✅ Optional (array) | ❌ Missing | ⚠️ Missing |
| orderType | ✅ Optional | ❌ Missing | ⚠️ Missing |
| orderStatus | ✅ Optional | ✅ Has (as "status") | ⚠️ **DIFFERENT NAME** |
| swapper | ✅ Optional | ✅ Has | ✅ |
| filler | ✅ Optional | ❌ Missing | ⚠️ Missing |
| limit | ✅ Optional | ❌ Missing | ⚠️ Missing |
| sortKey | ✅ Optional | ❌ Missing | ⚠️ Missing |
| sort | ✅ Optional | ❌ Missing | ⚠️ Missing |
| cursor | ✅ Optional | ❌ Missing | ⚠️ Missing |
| status | ❌ Not in docs | ✅ Using this | ⚠️ Should be orderStatus |

#### Response Schema Comparison

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| requestId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| orders | ✅ Required (array) | ✅ Has | ✅ |
| cursor | ✅ Optional | ❌ Missing | ⚠️ Missing |

**Order Object Comparison:**

| **Field** | **Official Docs** | **Our Implementation** | **Status** |
|-----------|-------------------|------------------------|------------|
| type | ✅ Required | ❌ Missing | ❌ **MISSING** |
| encodedOrder | ✅ Required | ❌ Missing | ❌ **MISSING** |
| signature | ✅ Required | ❌ Missing | ❌ **MISSING** |
| nonce | ✅ Required | ❌ Missing | ❌ **MISSING** |
| orderStatus | ✅ Required | ✅ Has (as status) | ⚠️ **DIFFERENT NAME** |
| orderId | ✅ Required | ✅ Has | ✅ |
| chainId | ✅ Required | ❌ Missing | ❌ **MISSING** |
| quoteId | ✅ Optional | ❌ Missing | ⚠️ Missing |
| swapper | ✅ Optional | ❌ Missing | ⚠️ Missing |
| txHash | ✅ Optional | ✅ Has | ✅ |
| input | ✅ Optional | ❌ Missing | ⚠️ Missing |
| outputs | ✅ Optional | ❌ Missing | ⚠️ Missing |
| settledAmounts | ✅ Optional | ❌ Missing | ⚠️ Missing |
| cosignature | ✅ Optional | ❌ Missing | ⚠️ Missing |
| cosignerData | ✅ Optional | ❌ Missing | ⚠️ Missing |
| filledAt | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |
| errorMessage | ❌ Not in docs | ✅ Has | ⚠️ **EXTRA** |

---

### Order Status Enum

| **Status Value** | **Official Docs** | **Our Implementation** | **Status** |
|------------------|-------------------|------------------------|------------|
| open | ✅ | ✅ | ✅ |
| expired | ✅ | ✅ | ✅ |
| error | ✅ | ✅ | ✅ |
| cancelled | ✅ | ✅ | ✅ |
| filled | ✅ | ✅ | ✅ |
| unverified | ✅ | ❌ Missing | ❌ **MISSING** |
| insufficient-funds | ✅ | ✅ | ✅ |

---

### Missing Endpoints

These endpoints exist in the official API but are NOT implemented in our code:

1. ❌ **GET /swaps** - Get swap/bridge transaction status
2. ❌ **POST /swap_5792** - Create EIP-5792 batch swap
3. ❌ **POST /swap_7702** - Create EIP-7702 smart wallet swap
4. ❌ **POST /send** - Create token send transaction
5. ❌ **GET /swappable_tokens** - Get bridgeable tokens
6. ❌ **POST /lp/approve** - Check LP approvals
7. ❌ **POST /lp/create** - Create liquidity position
8. ❌ **POST /lp/increase** - Increase LP position
9. ❌ **POST /lp/decrease** - Decrease LP position
10. ❌ **POST /lp/claim** - Claim LP fees
11. ❌ **POST /lp/migrate** - Migrate LP position
12. ❌ **POST /lp/claim_rewards** - Claim LP rewards
13. ❌ **POST /limit_order_quote** - Get limit order quote
14. ❌ **POST /wallet/encode_7702** - Encode wallet transactions
15. ❌ **POST /wallet/check_delegation** - Check wallet delegation
16. ❌ **POST /indicative_quote** - Fast quote (deprecated, use /quote)

---

## Critical Issues & Gaps

### P0 - Critical (Must Fix Immediately)

#### 1. Base URL is Completely Wrong
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/uniswap.api.client.ts:55`

**Current:**
```typescript
this.baseURL = baseURL || process.env.UNISWAP_API_URL || 'https://api.gateway.uniswap.org/v2';
```

**Should be:**
```typescript
this.baseURL = baseURL || process.env.UNISWAP_API_URL || 'https://trade-api.gateway.uniswap.org/v1';
```

**Impact:** ALL API calls are failing or hitting wrong endpoints
**Priority:** P0 - CRITICAL

---

#### 2. Quote Request Schema is Wrong
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:16-40`

**Current Interface:**
```typescript
export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  recipient: string;  // WRONG - should be "swapper"
  slippage: string;   // WRONG - should be "slippageTolerance"
  chainId: number;    // WRONG - should be "tokenInChainId" and "tokenOutChainId"
  enableUniversalRouter?: boolean;  // NOT IN DOCS
}
```

**Should be:**
```typescript
export interface QuoteParams {
  // REQUIRED
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  amount: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  tokenIn: string;
  tokenOut: string;
  swapper: string;

  // OPTIONAL
  slippageTolerance?: string;
  autoSlippage?: {
    enabled: boolean;
    maxSlippageTolerance?: string;
    minSlippageTolerance?: string;
  };
  routingPreference?: 'BEST_PRICE' | 'FASTEST';
  protocols?: Array<'V2' | 'V3' | 'V4' | 'UNISWAPX_V2' | 'UNISWAPX_V3'>;
  generatePermitAsTransaction?: boolean;
  hooksOptions?: object;
  spreadOptimization?: boolean;
  urgency?: 'urgent' | 'normal' | 'low';
  permitAmount?: string;
}
```

**Impact:** Quote requests are failing or returning incorrect data
**Priority:** P0 - CRITICAL

---

#### 3. Swap Request Schema is Wrong
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:167-206`

**Current Implementation:**
We're sending individual parameters like `tokenIn`, `tokenOut`, `amount`, etc.

**Should be:**
```typescript
export interface SwapParams {
  quote: ClassicQuote | WrapUnwrapQuote | BridgeQuote;
  signature?: string;
  permitData?: object;
  refreshGasPrice?: boolean;
  simulateTransaction?: boolean;
  safetyMode?: 'SAFE' | 'UNSAFE';
  deadline?: number;
  urgency?: 'urgent' | 'normal' | 'low';
}
```

**The API expects the ENTIRE quote object from /quote to be sent back, not individual fields.**

**Impact:** Swap creation is failing
**Priority:** P0 - CRITICAL

---

#### 4. Order Request Schema is Wrong
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:246-267`

**Current Implementation:**
We're sending individual parameters like `tokenIn`, `tokenOut`, `swapper`, etc.

**Should be:**
```typescript
export interface OrderParams {
  signature: string;
  quote: DutchQuoteV2 | DutchQuoteV3 | PriorityQuote;
  routing: 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY';
}
```

**Impact:** Order creation is failing
**Priority:** P0 - CRITICAL

---

#### 5. Missing Routing Types
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts:79-94`

**Current:**
```typescript
export enum UniswapRouting {
  CLASSIC = 'CLASSIC',
  DUTCH_V2 = 'DUTCH_V2',
  DUTCH_V3 = 'DUTCH_V3',
  BRIDGE = 'BRIDGE',
  PRIORITY = 'PRIORITY',
}
```

**Should be:**
```typescript
export enum UniswapRouting {
  CLASSIC = 'CLASSIC',
  DUTCH_V2 = 'DUTCH_V2',
  DUTCH_V3 = 'DUTCH_V3',
  BRIDGE = 'BRIDGE',
  PRIORITY = 'PRIORITY',
  WRAP = 'WRAP',
  UNWRAP = 'UNWRAP',
  LIMIT_ORDER = 'LIMIT_ORDER',
  DUTCH_LIMIT = 'DUTCH_LIMIT',
}
```

**Impact:** Cannot handle wrap/unwrap or limit order routing
**Priority:** P0 - CRITICAL

---

#### 6. Wrong Chain ID for Soneium
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts:39`

**Current:**
```typescript
1946,    // Soneium
```

**Should be:**
```typescript
1868,    // Soneium
```

**Impact:** Soneium swaps will fail
**Priority:** P0 - CRITICAL

---

#### 7. Missing requestId in All Responses
**Location:** Multiple files - all response interfaces

**Current:** No `requestId` field in any response interface

**Should have:** All API responses include a `requestId` field for tracking

**Impact:** Cannot track requests, debugging is harder
**Priority:** P0 - CRITICAL

---

#### 8. Check Approval Response Structure is Wrong
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:118-155`

**Current:**
```typescript
export interface CheckApprovalResponse {
  approval: {
    isRequired: boolean;  // NOT IN DOCS
    permitData?: object;
    approvalTransaction?: object;
  };
}
```

**Should be:**
```typescript
export interface CheckApprovalResponse {
  requestId: string;
  approval: TransactionRequest | null;  // null if not needed
  cancel: TransactionRequest | null;     // for token reset
  gasFee?: string;
  cancelGasFee?: string;
}
```

**Impact:** Cannot determine if approval is needed, missing cancel transaction
**Priority:** P0 - CRITICAL

---

### P1 - Important (Fix Soon)

#### 9. Missing Order Status Value
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:330-336`

**Current:**
```typescript
export type OrderStatus =
  | 'open'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'error'
  | 'insufficient-funds';
```

**Should be:**
```typescript
export type OrderStatus =
  | 'open'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'error'
  | 'insufficient-funds'
  | 'unverified';  // MISSING
```

**Priority:** P1

---

#### 10. Missing Celo Chain
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts:25-40`

**Should add:**
```typescript
42220,   // Celo
```

**Priority:** P1

---

#### 11. Quote Response Missing Many Fields
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:45-89`

**Missing fields in quote object:**
- `input` (token and amount)
- `output` (token and amount)
- `swapper`
- `tradeType`
- `gasFeeUSD`
- `gasFeeQuote`
- `portionBips` (fee portion)
- `portionAmount`
- `portionRecipient`
- `routeString`
- `quoteId`
- `blockNumber`
- `gasPrice`
- `maxFeePerGas`
- `maxPriorityFeePerGas`
- `txFailureReasons`
- `aggregatedOutputs`

**Priority:** P1

---

#### 12. Missing Optional Parameters in Quote Request
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:16-40`

**Missing:**
- `autoSlippage`
- `routingPreference`
- `protocols`
- `generatePermitAsTransaction`
- `hooksOptions`
- `spreadOptimization`
- `urgency`
- `permitAmount`

**Priority:** P1

---

#### 13. Missing Optional Parameters in Check Approval
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:101-113`

**Missing:**
- `urgency`
- `includeGasInfo`
- `tokenOut`
- `tokenOutChainId`

**Priority:** P1

---

#### 14. Order Status Response Missing Fields
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:341-358`

**Missing in order object:**
- `type`
- `encodedOrder`
- `signature`
- `nonce`
- `chainId`
- `quoteId`
- `swapper`
- `input`
- `outputs`
- `settledAmounts`
- `cosignature`
- `cosignerData`

**Priority:** P1

---

#### 15. Missing Query Parameters in /orders
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:316-325`

**Missing:**
- `orderIds` (multiple IDs)
- `orderType`
- `filler`
- `limit`
- `sortKey`
- `sort`
- `cursor`

**Priority:** P1

---

#### 16. Swap Response Missing gasFee
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:211-235`

**Missing:** `gasFee` field in response

**Priority:** P1

---

#### 17. Missing Swap Request Optional Parameters
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts:167-206`

**Missing:**
- `refreshGasPrice`
- `simulateTransaction`
- `safetyMode`
- `deadline`
- `urgency`

**Priority:** P1

---

#### 18. Wrong Parameter Name in Provider
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts:111`

**Current:**
```typescript
recipient: request.receiver,
```

**Should be:**
```typescript
swapper: request.sender,
```

**Priority:** P1

---

#### 19. Wrong Slippage Parameter Name
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts:112`

**Current:**
```typescript
slippage: DEFAULT_SLIPPAGE_TOLERANCE,
```

**Should be:**
```typescript
slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
```

**Priority:** P1

---

#### 20. Missing Cross-Chain Support
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts:106-114`

**Current:** Using `chainId` for both tokens

**Should:** Use `tokenInChainId` and `tokenOutChainId` separately

**Priority:** P1

---

### P2 - Nice to Have

#### 21. Missing Beta Environment Support
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/uniswap.api.client.ts`

**Should add:** Support for beta URL: `https://beta.trade-api.gateway.uniswap.org/v1`

**Priority:** P2

---

#### 22. Missing x-universal-router-version Header
**Location:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/uniswap.api.client.ts:60-65`

**Should add:** Optional header support for Universal Router version

**Priority:** P2

---

#### 23. Missing 16 Endpoints
**Priority:** P2 (unless needed for specific features)

All liquidity, batch swap, limit order, and wallet endpoints are missing.

---

## Required Fixes

### Fix 1: Correct Base URL (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/uniswap.api.client.ts`

**Line 55:**
```typescript
// BEFORE
this.baseURL = baseURL || process.env.UNISWAP_API_URL || 'https://api.gateway.uniswap.org/v2';

// AFTER
this.baseURL = baseURL || process.env.UNISWAP_API_URL || 'https://trade-api.gateway.uniswap.org/v1';
```

---

### Fix 2: Correct Quote Request Schema (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 16-40:**
```typescript
// REPLACE THIS
export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  recipient: string;
  slippage: string;
  chainId: number;
  enableUniversalRouter?: boolean;
}

// WITH THIS
export interface QuoteParams {
  // REQUIRED FIELDS
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  amount: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  tokenIn: string;
  tokenOut: string;
  swapper: string;

  // OPTIONAL FIELDS
  slippageTolerance?: string;
  autoSlippage?: {
    enabled: boolean;
    maxSlippageTolerance?: string;
    minSlippageTolerance?: string;
  };
  routingPreference?: 'BEST_PRICE' | 'FASTEST';
  protocols?: Array<'V2' | 'V3' | 'V4' | 'UNISWAPX_V2' | 'UNISWAPX_V3'>;
  generatePermitAsTransaction?: boolean;
  hooksOptions?: Record<string, unknown>;
  spreadOptimization?: boolean;
  urgency?: 'urgent' | 'normal' | 'low';
  permitAmount?: string;
}
```

---

### Fix 3: Add requestId to Quote Response (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 45-89:**
```typescript
export interface QuoteResponse {
  /** Unique request ID for tracking */
  requestId: string;  // ADD THIS

  /** Routing type determines which endpoint to call next */
  routing: UniswapRouting;

  /** Quote details */
  quote: {
    /** Input token and amount */
    input: {
      token: string;
      amount: string;
    };

    /** Output token and amount */
    output: {
      token: string;
      amount: string;
    };

    /** Swapper address */
    swapper: string;

    /** Chain ID */
    chainId: number;

    /** Trade type */
    tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';

    /** Applied slippage */
    slippage: string;

    /** Price impact percentage */
    priceImpact?: number;

    /** Gas fee estimate (wei) */
    gasFee?: string;

    /** Gas fee in USD */
    gasFeeUSD?: string;

    /** Gas fee in quote currency */
    gasFeeQuote?: string;

    /** Gas usage estimate (units) */
    gasUseEstimate?: string;

    /** Route path - for CLASSIC routing */
    route?: Array<Array<{
      pool: string;
      tokenIn: string;
      tokenOut: string;
      protocol: 'V2' | 'V3' | 'V4';
      fee?: string;
      sqrtRatioX96?: string;
      liquidity?: string;
      tickCurrent?: number;
    }>>;

    /** Fee portion in bips */
    portionBips?: number;

    /** Fee amount */
    portionAmount?: string;

    /** Fee recipient */
    portionRecipient?: string;

    /** Human-readable route */
    routeString?: string;

    /** Quote ID for tracking */
    quoteId?: string;

    /** Block number */
    blockNumber?: string;

    /** Gas price */
    gasPrice?: string;

    /** EIP-1559 max fee per gas */
    maxFeePerGas?: string;

    /** EIP-1559 max priority fee */
    maxPriorityFeePerGas?: string;

    /** Transaction failure reasons from simulation */
    txFailureReasons?: Array<string>;

    /** Aggregated outputs for multi-output swaps */
    aggregatedOutputs?: Array<{
      token: string;
      amount: string;
    }>;

    /** Order info - for UniswapX routing */
    orderInfo?: {
      orderId: string;
      reactor: string;
      swapper: string;
      nonce: string;
      deadline: number;
      input: { token: string; amount: string };
      outputs: Array<{
        token: string;
        startAmount: string;
        endAmount: string;
        recipient: string;
      }>;
      decayStartTime?: number;
      decayEndTime?: number;
    };

    /** Encoded order data - for UniswapX */
    encodedOrder?: string;

    /** Slippage tolerance */
    slippageTolerance?: string;

    /** Deadline buffer in seconds */
    deadlineBufferSecs?: number;

    /** Classic gas estimate in USD */
    classicGasUseEstimateUSD?: string;
  };

  /** Permit2 signature data (nullable) */
  permitData: {
    domain: {
      name: string;
      chainId: number;
      verifyingContract: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    values: {
      permitted: {
        token: string;
        amount: string;
      };
      spender: string;
      nonce: string;
      deadline: string;
    };
  } | null;

  /** Traditional permit transaction */
  permitTransaction?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };

  /** Permit gas fee */
  permitGasFee?: string;
}
```

---

### Fix 4: Fix Routing Enum (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts`

**Lines 79-94:**
```typescript
// REPLACE THIS
export enum UniswapRouting {
  CLASSIC = 'CLASSIC',
  DUTCH_V2 = 'DUTCH_V2',
  DUTCH_V3 = 'DUTCH_V3',
  BRIDGE = 'BRIDGE',
  PRIORITY = 'PRIORITY',
}

// WITH THIS
export enum UniswapRouting {
  CLASSIC = 'CLASSIC',
  DUTCH_V2 = 'DUTCH_V2',
  DUTCH_V3 = 'DUTCH_V3',
  BRIDGE = 'BRIDGE',
  PRIORITY = 'PRIORITY',
  WRAP = 'WRAP',
  UNWRAP = 'UNWRAP',
  LIMIT_ORDER = 'LIMIT_ORDER',
  DUTCH_LIMIT = 'DUTCH_LIMIT',
}
```

---

### Fix 5: Fix Soneium Chain ID (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts`

**Line 39:**
```typescript
// BEFORE
1946,    // Soneium

// AFTER
1868,    // Soneium
```

---

### Fix 6: Add Celo Chain (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/constants.ts`

**After line 40:**
```typescript
42220,   // Celo
```

---

### Fix 7: Fix CheckApprovalResponse (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 118-155:**
```typescript
// REPLACE THIS
export interface CheckApprovalResponse {
  approval: {
    isRequired: boolean;
    permitData?: {
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };
      types: Record<string, Array<{ name: string; type: string }>>;
      values: {
        permitted: {
          token: string;
          amount: string;
        };
        spender: string;
        nonce: string;
        deadline: string;
      };
    };
    approvalTransaction?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  };
}

// WITH THIS
export interface CheckApprovalResponse {
  /** Unique request ID */
  requestId: string;

  /** Approval transaction (null if not needed) */
  approval: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  } | null;

  /** Cancel transaction (for tokens requiring reset, null otherwise) */
  cancel: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  } | null;

  /** Approval gas fee */
  gasFee?: string;

  /** Cancel gas fee */
  cancelGasFee?: string;
}
```

---

### Fix 8: Add Missing Optional Fields to CheckApprovalParams (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 101-113:**
```typescript
export interface CheckApprovalParams {
  /** Wallet address */
  walletAddress: string;

  /** Token to approve */
  token: string;

  /** Amount to approve (wei) */
  amount: string;

  /** Chain ID */
  chainId: number;

  /** Transaction urgency */
  urgency?: 'urgent' | 'normal' | 'low';

  /** Include gas info (deprecated) */
  includeGasInfo?: boolean;

  /** Output token address */
  tokenOut?: string;

  /** Output token chain ID */
  tokenOutChainId?: number;
}
```

---

### Fix 9: Fix SwapParams Interface (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 167-206:**
```typescript
// REPLACE EVERYTHING WITH THIS
export interface SwapParams {
  /** Quote object from /quote endpoint */
  quote: Record<string, unknown>;  // ClassicQuote | WrapUnwrapQuote | BridgeQuote

  /** Signed permit (if permitData was returned from /quote) */
  signature?: string;

  /** Permit data (if permitData was returned from /quote) */
  permitData?: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    values: Record<string, unknown>;
  };

  /** Re-fetch gas price from network */
  refreshGasPrice?: boolean;

  /** Simulate transaction before returning */
  simulateTransaction?: boolean;

  /** Safety mode */
  safetyMode?: 'SAFE' | 'UNSAFE';

  /** Transaction deadline (timestamp) */
  deadline?: number;

  /** Transaction urgency */
  urgency?: 'urgent' | 'normal' | 'low';
}
```

---

### Fix 10: Fix SwapResponse Interface (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 211-235:**
```typescript
export interface SwapResponse {
  /** Unique request ID */
  requestId: string;

  /** Transaction to sign and send */
  swap: {
    /** Contract address to call */
    to: string;

    /** Calldata */
    data: string;

    /** ETH value to send (wei) */
    value: string;

    /** Chain ID */
    chainId: number;

    /** Gas limit estimate */
    gasLimit?: string;

    /** Max fee per gas (EIP-1559) */
    maxFeePerGas?: string;

    /** Max priority fee (EIP-1559) */
    maxPriorityFeePerGas?: string;
  };

  /** Gas fee estimate */
  gasFee?: string;
}
```

---

### Fix 11: Fix OrderParams Interface (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 246-267:**
```typescript
// REPLACE EVERYTHING WITH THIS
export interface OrderParams {
  /** Signed permit */
  signature: string;

  /** Quote object from /quote endpoint */
  quote: Record<string, unknown>;  // DutchQuoteV2 | DutchQuoteV3 | PriorityQuote

  /** Routing type */
  routing: 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY';
}
```

---

### Fix 12: Fix OrderResponse Interface (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 272-305:**
```typescript
// REPLACE EVERYTHING WITH THIS
export interface OrderResponse {
  /** Unique request ID */
  requestId: string;

  /** Unique order ID */
  orderId: string;

  /** Order status */
  orderStatus: OrderStatus;
}
```

---

### Fix 13: Fix OrderStatus Type (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 330-336:**
```typescript
export type OrderStatus =
  | 'open'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'error'
  | 'insufficient-funds'
  | 'unverified';  // ADD THIS
```

---

### Fix 14: Fix OrderStatusParams Interface (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 316-325:**
```typescript
export interface OrderStatusParams {
  /** Single order ID to check */
  orderId?: string;

  /** Multiple order IDs to check (comma-separated) */
  orderIds?: string[];

  /** Order type to filter by */
  orderType?: string;

  /** Status to filter by */
  orderStatus?: OrderStatus;

  /** Swapper address to filter by */
  swapper?: string;

  /** Filler address to filter by */
  filler?: string;

  /** Results limit */
  limit?: number;

  /** Sort field */
  sortKey?: string;

  /** Sort direction */
  sort?: 'asc' | 'desc';

  /** Pagination cursor */
  cursor?: string;
}
```

---

### Fix 15: Fix OrderStatusResponse Interface (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/types.ts`

**Lines 341-358:**
```typescript
export interface OrderStatusResponse {
  /** Unique request ID */
  requestId: string;

  /** Orders matching query */
  orders: Array<{
    /** Order type */
    type: string;

    /** Encoded order data */
    encodedOrder: string;

    /** Order signature */
    signature: string;

    /** Order nonce */
    nonce: string;

    /** Order ID */
    orderId: string;

    /** Current status */
    orderStatus: OrderStatus;

    /** Chain ID */
    chainId: number;

    /** Quote ID */
    quoteId?: string;

    /** Swapper address */
    swapper?: string;

    /** Fill transaction hash (if filled) */
    txHash?: string;

    /** Input token and amount */
    input?: {
      token: string;
      amount: string;
    };

    /** Output tokens and amounts */
    outputs?: Array<{
      token: string;
      amount: string;
      recipient: string;
    }>;

    /** Settled amounts */
    settledAmounts?: Array<{
      token: string;
      amount: string;
    }>;

    /** Cosignature */
    cosignature?: string;

    /** Cosigner data */
    cosignerData?: Record<string, unknown>;
  }>;

  /** Pagination cursor */
  cursor?: string;
}
```

---

### Fix 16: Update Provider getQuote Method (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts`

**Lines 106-114:**
```typescript
// REPLACE THIS
const quoteResponse = await this.client.getQuote({
  tokenIn,
  tokenOut,
  amount: request.amount.toString(),
  type: "EXACT_INPUT",
  recipient: request.receiver,
  slippage: DEFAULT_SLIPPAGE_TOLERANCE,
  chainId: request.fromChainId,
});

// WITH THIS
const quoteResponse = await this.client.getQuote({
  type: "EXACT_INPUT",
  amount: request.amount.toString(),
  tokenInChainId: request.fromChainId,
  tokenOutChainId: request.toChainId,
  tokenIn,
  tokenOut,
  swapper: request.sender,
  slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
});
```

---

### Fix 17: Update Provider prepareSwap Method (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts`

**Lines 173-181 and 218-226:**
```typescript
// For getting quote - REPLACE THIS
const quoteResponse = await this.client.getQuote({
  tokenIn,
  tokenOut,
  amount: request.amount.toString(),
  type: "EXACT_INPUT",
  recipient: request.receiver,
  slippage: DEFAULT_SLIPPAGE_TOLERANCE,
  chainId: request.fromChainId,
});

// WITH THIS
const quoteResponse = await this.client.getQuote({
  type: "EXACT_INPUT",
  amount: request.amount.toString(),
  tokenInChainId: request.fromChainId,
  tokenOutChainId: request.toChainId,
  tokenIn,
  tokenOut,
  swapper: request.sender,
  slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
});

// For CLASSIC swap - REPLACE THIS
const swapResponse = await this.client.createSwap({
  tokenIn,
  tokenOut,
  amount: request.amount.toString(),
  type: "EXACT_INPUT",
  recipient: request.receiver,
  slippage: DEFAULT_SLIPPAGE_TOLERANCE,
  chainId: request.fromChainId,
});

// WITH THIS
const swapResponse = await this.client.createSwap({
  quote: quoteResponse.quote,  // Pass entire quote object
  // Optional: add signature if permit was signed
  // Optional: add permitData if needed
  simulateTransaction: true,
});

// For UniswapX order - REPLACE THIS
const orderResponse = await this.client.createOrder({
  tokenIn,
  tokenOut,
  amount: request.amount.toString(),
  type: "EXACT_INPUT",
  swapper: request.sender,
  slippage: DEFAULT_SLIPPAGE_TOLERANCE,
  chainId: request.fromChainId,
});

// WITH THIS
const orderResponse = await this.client.createOrder({
  signature: "<PERMIT_SIGNATURE>",  // Get from user signing permitData
  quote: quoteResponse.quote,       // Pass entire quote object
  routing: quoteResponse.routing,   // Pass routing type
});
```

---

### Fix 18: Handle Approval Response Structure (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts`

**Lines 188-208:**
```typescript
// REPLACE THIS
if (approvalCheck.approval.isRequired) {
  console.log("[UniswapProvider] ⚠️ Approval required");

  // Uniswap uses Permit2 (gasless signature)
  if (approvalCheck.approval.permitData) {
    throw new Error(
      `PERMIT2_SIGNATURE_REQUIRED: ${JSON.stringify(approvalCheck.approval.permitData)}`
    );
  }

  // Fallback: traditional approval (shouldn't happen)
  throw new Error("APPROVAL_REQUIRED: Token approval needed");
}

// WITH THIS
if (approvalCheck.approval !== null) {
  console.log("[UniswapProvider] ⚠️ Approval required");

  // Return approval transaction to be signed and sent
  throw new Error(
    `APPROVAL_REQUIRED: ${JSON.stringify({
      approval: approvalCheck.approval,
      cancel: approvalCheck.cancel,
      gasFee: approvalCheck.gasFee,
      cancelGasFee: approvalCheck.cancelGasFee,
    })}`
  );
}
```

---

### Fix 19: Update getOrderStatus Method (P1)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap/uniswap.api.client.ts`

**Lines 179-183:**
```typescript
// REPLACE THIS
const queryParams = new URLSearchParams();
if (params.orderId) queryParams.append('orderId', params.orderId);
if (params.swapper) queryParams.append('swapper', params.swapper);
if (params.status) queryParams.append('status', params.status);

// WITH THIS
const queryParams = new URLSearchParams();
if (params.orderId) queryParams.append('orderId', params.orderId);
if (params.orderIds) params.orderIds.forEach(id => queryParams.append('orderIds', id));
if (params.orderType) queryParams.append('orderType', params.orderType);
if (params.orderStatus) queryParams.append('orderStatus', params.orderStatus);
if (params.swapper) queryParams.append('swapper', params.swapper);
if (params.filler) queryParams.append('filler', params.filler);
if (params.limit) queryParams.append('limit', params.limit.toString());
if (params.sortKey) queryParams.append('sortKey', params.sortKey);
if (params.sort) queryParams.append('sort', params.sort);
if (params.cursor) queryParams.append('cursor', params.cursor);
```

---

### Fix 20: Add Handling for New Routing Types (P0)

**File:** `/panorama-block-backend/liquid-swap-service/src/infrastructure/adapters/uniswap.provider.adapter.ts`

**Lines 450-463:**
```typescript
private getEstimatedDuration(routing: UniswapRouting): number {
  switch (routing) {
    case UniswapRouting.CLASSIC:
      return 30; // 30 seconds for V2/V3/V4
    case UniswapRouting.DUTCH_V2:
    case UniswapRouting.DUTCH_V3:
    case UniswapRouting.PRIORITY:
      return 120; // 2 minutes for UniswapX orders
    case UniswapRouting.BRIDGE:
      return 600; // 10 minutes
    case UniswapRouting.WRAP:
    case UniswapRouting.UNWRAP:
      return 15; // 15 seconds for wrap/unwrap
    case UniswapRouting.LIMIT_ORDER:
    case UniswapRouting.DUTCH_LIMIT:
      return 3600; // 1 hour for limit orders
    default:
      return 60; // 1 minute default
  }
}
```

---

## Recommendations

### 1. Implement Quote Flow Correctly

The correct flow should be:

1. **Get Quote:**
```typescript
const quoteResponse = await client.getQuote({
  type: 'EXACT_INPUT',
  amount: '1000000',
  tokenInChainId: 1,
  tokenOutChainId: 1,
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  swapper: '0x...',
  slippageTolerance: '0.5',
});
```

2. **Check Approval (if needed):**
```typescript
const approvalCheck = await client.checkApproval({
  walletAddress: swapper,
  token: tokenIn,
  amount: amount,
  chainId: chainId,
});

if (approvalCheck.approval !== null) {
  // Send approval transaction
  // If cancel is not null, send cancel transaction first
}
```

3. **Sign Permit (if permitData exists):**
```typescript
if (quoteResponse.permitData) {
  const signature = await wallet.signTypedData(
    quoteResponse.permitData.domain,
    quoteResponse.permitData.types,
    quoteResponse.permitData.values
  );
}
```

4. **Create Swap or Order:**
```typescript
if (quoteResponse.routing === 'CLASSIC') {
  const swapResponse = await client.createSwap({
    quote: quoteResponse.quote,
    signature: signature,  // if permit was signed
    permitData: quoteResponse.permitData,
    simulateTransaction: true,
  });

  // Send swap transaction
  await wallet.sendTransaction(swapResponse.swap);
} else {
  const orderResponse = await client.createOrder({
    signature: signature,
    quote: quoteResponse.quote,
    routing: quoteResponse.routing,
  });

  // Order is submitted, monitor via orderId
}
```

---

### 2. Add Comprehensive Error Handling

Handle all error codes properly:
- `400`: Log validation errors, show user-friendly message
- `401`: Check API key, refresh if needed
- `404`: No route found - suggest different parameters
- `419`: Implement exponential backoff for rate limits
- `500/504`: Retry with exponential backoff

---

### 3. Implement Request Tracking

Use `requestId` from all responses to track requests through logs and debugging.

---

### 4. Add Support for Optional Features

Consider implementing:
- `routingPreference`: Allow users to choose BEST_PRICE vs FASTEST
- `protocols`: Allow users to specify preferred protocols
- `autoSlippage`: Automatic slippage calculation
- `simulateTransaction`: Always simulate before sending
- `urgency`: Gas price optimization

---

### 5. Support Cross-Chain Swaps

The API supports cross-chain via BRIDGE routing. Implement:
```typescript
const quote = await client.getQuote({
  tokenInChainId: 1,      // Ethereum
  tokenOutChainId: 10,    // Optimism
  tokenIn: 'USDC on Ethereum',
  tokenOut: 'USDC on Optimism',
  // ...
});
```

---

### 6. Implement Proper Type Guards

Add runtime type checking for routing types:
```typescript
function isClassicRouting(routing: UniswapRouting): boolean {
  return routing === UniswapRouting.CLASSIC;
}

function isUniswapXRouting(routing: UniswapRouting): boolean {
  return [
    UniswapRouting.DUTCH_V2,
    UniswapRouting.DUTCH_V3,
    UniswapRouting.PRIORITY,
  ].includes(routing);
}

function isWrapRouting(routing: UniswapRouting): boolean {
  return [
    UniswapRouting.WRAP,
    UniswapRouting.UNWRAP,
  ].includes(routing);
}
```

---

### 7. Add Integration Tests

Test against actual API:
```typescript
describe('Uniswap API Integration', () => {
  it('should get quote for USDC -> ETH', async () => {
    const quote = await client.getQuote({...});
    expect(quote.requestId).toBeDefined();
    expect(quote.routing).toBeDefined();
  });

  it('should handle no route found error', async () => {
    // Test with invalid token pair
  });

  it('should handle rate limiting', async () => {
    // Test rapid requests
  });
});
```

---

### 8. Monitoring and Observability

Add metrics for:
- Quote success/failure rates
- Swap success/failure rates
- Average quote latency
- Order fill rates
- Error rates by type

---

### 9. Documentation

Document:
- How to get quotes
- How to handle approvals
- How to sign permits
- How to execute swaps
- How to monitor orders
- Error handling strategies

---

## Summary

### Critical Path to Fix

1. ✅ Fix base URL (line 55 in uniswap.api.client.ts)
2. ✅ Fix QuoteParams interface
3. ✅ Fix SwapParams interface (must send quote object)
4. ✅ Fix OrderParams interface (must send quote object)
5. ✅ Fix CheckApprovalResponse structure
6. ✅ Add missing routing types
7. ✅ Fix Soneium chain ID
8. ✅ Update all provider method calls
9. ✅ Add requestId to all responses
10. ✅ Implement proper quote flow

### Estimated Effort

- **P0 Fixes:** 4-6 hours
- **P1 Fixes:** 8-12 hours
- **P2 Features:** 16-24 hours
- **Testing & Documentation:** 8-12 hours

**Total:** 36-54 hours of development work

### Testing Checklist

- [ ] Base URL is correct
- [ ] Quote request uses correct field names
- [ ] Quote response includes requestId
- [ ] Swap request sends quote object
- [ ] Order request sends quote object
- [ ] CheckApproval response structure is correct
- [ ] All routing types are supported
- [ ] Chain IDs are correct
- [ ] Order status includes 'unverified'
- [ ] Cross-chain swaps work (BRIDGE routing)
- [ ] Wrap/unwrap works
- [ ] Error handling for all error codes
- [ ] Rate limiting is handled
- [ ] Request tracking via requestId
- [ ] Integration tests pass

---

**End of Audit Report**

Generated: October 14, 2025
