# Uniswap Trading API - Comprehensive Analysis

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Quote vs Execute Flow](#quote-vs-execute-flow)
5. [Approval & Permit2](#approval--permit2)
6. [Supported Chains & Tokens](#supported-chains--tokens)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Transaction Monitoring](#transaction-monitoring)
10. [Best Practices](#best-practices)

---

## Overview

The Uniswap Trading API provides programmatic access to token swapping, cross-chain bridging, liquidity provision, and advanced trading features across 13+ blockchains.

### Key Features
- Token swapping across multiple chains
- Cross-chain token bridging
- Limit orders
- Batched actions (EIP-5792)
- Smart wallet support (EIP-7702)
- MEV protection via UniswapX
- Access to public, private, and off-chain liquidity

### Supported Protocols
- **Uniswap Protocols**: V2, V3, V4
- **UniswapX**: V2, V3 (RFQ swap mechanism with gasless execution)

### Base URLs
- **Production**: `https://trade-api.gateway.uniswap.org/v1`
- **Beta**: `https://beta.trade-api.gateway.uniswap.org/v1`

---

## Authentication

### API Key Requirements
- All endpoints require an API key
- Obtain API key at: https://hub.uniswap.org/
- Must complete intake form to get access

### Header Format
```bash
x-api-key: <YOUR_API_KEY>
```

### Example Request
```bash
curl --request POST \
  --url https://trade-api.gateway.uniswap.org/v1/quote \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --header 'x-api-key: <YOUR_API_KEY>' \
  --data '{...}'
```

---

## API Endpoints

### 1. Check Approval - `/check_approval`

**Purpose**: Check if wallet has sufficient token approval for Permit2 contract

**Method**: `POST`

**Request Schema**:
```json
{
  "walletAddress": "string (hex address, required)",
  "token": "string (contract address, required)",
  "amount": "string (base units, required)",
  "chainId": "number (required)",
  "urgency": "string (optional: 'normal' | 'fast' | 'urgent', default: 'urgent')",
  "includeGasInfo": "boolean (optional, default: false)",
  "tokenOut": "string (optional)",
  "tokenOutChainId": "number (optional)"
}
```

**Response Schema**:
```json
{
  "requestId": "string",
  "approval": {
    "to": "string (contract address)",
    "data": "string (calldata)",
    "chainId": "number",
    "value": "string",
    "gasLimit": "string"
  },
  "cancel": {
    "to": "string",
    "data": "string",
    "chainId": "number"
  },
  "gasFee": "string (estimated gas cost)",
  "cancelGasFee": "string"
}
```

**Behavior**:
- If sufficient approval exists: Returns `null` for `approval` field
- If insufficient approval: Returns approval transaction
- Some tokens require approval reset: Returns both `cancel` and `approval` transactions

**Error Codes**: 400, 401, 404, 419, 500, 504

---

### 2. Quote - `/quote`

**Purpose**: Get a quote for token swap, bridge, or wrap/unwrap with routing details

**Method**: `POST`

**Request Schema**:
```json
{
  "type": "EXACT_INPUT | EXACT_OUTPUT (required)",
  "amount": "string (token quantity in base units, required)",
  "tokenInChainId": "number (required)",
  "tokenOutChainId": "number (required)",
  "tokenIn": "string (token address, required)",
  "tokenOut": "string (token address, required)",
  "swapper": "string (sender wallet address, required)",
  "slippageTolerance": "string (optional, percentage)",
  "routingPreference": "BEST_PRICE | FASTEST (optional)",
  "protocols": ["V2", "V3", "V4", "UNISWAPX_V2", "UNISWAPX_V3"] (optional),
  "generatePermitAsTransaction": "boolean (optional)",
  "hooksOptions": "object (optional, V4 pool hooks)",
  "spreadOptimization": "string (optional)",
  "urgency": "string (optional)"
}
```

**Response Schema**:
```json
{
  "requestId": "string",
  "quote": {
    "input": {
      "token": "string (address)",
      "amount": "string",
      "chainId": "number"
    },
    "output": {
      "token": "string (address)",
      "amount": "string",
      "recipient": "string",
      "chainId": "number"
    },
    "gasFee": "string",
    "gasFeeUSD": "string",
    "priceImpact": "string",
    "slippageTolerance": "string",
    "route": "array (routing details)",
    "tradeType": "EXACT_INPUT | EXACT_OUTPUT",
    "encodedOrder": "string (for UniswapX orders)",
    "orderId": "string (for UniswapX orders)",
    "orderInfo": "object (for UniswapX orders)",
    "quoteId": "string"
  },
  "routing": "CLASSIC | DUTCH_V2 | DUTCH_V3 | PRIORITYQUOTE | BRIDGE",
  "permitData": {
    "domain": "object (EIP-712 domain)",
    "types": "object (EIP-712 types)",
    "values": "object (EIP-712 values)"
  }
}
```

**Key Fields**:
- `routing`: Determines which endpoint to call next (`CLASSIC` -> `/swap`, `DUTCH_*`/`PRIORITYQUOTE` -> `/order`)
- `permitData`: EIP-712 structured data for signing token approval
- `quote`: Contains all swap details including estimates

**Error Codes**: 400, 401, 404, 419, 500, 504

**Notes**:
- Quotes are automatically simulated
- Cross-chain swaps supported
- UniswapX L2 orders require minimum 300 USDC-equivalent value

---

### 3. Create Protocol Swap - `/swap`

**Purpose**: Execute "gasful" swaps against Uniswap V2/V3/V4 pools, bridges, or wrap/unwrap

**Method**: `POST`

**When to Use**: When quote `routing` field is `CLASSIC` or `BRIDGE`

**Request Schema**:
```json
{
  "quote": "object (from /quote response, required)",
  "signature": "string (optional, signed permit)",
  "permitData": "object (optional, Permit2 message)",
  "refreshGasPrice": "boolean (optional)",
  "simulateTransaction": "boolean (optional)",
  "safetyMode": "boolean (optional)",
  "deadline": "number (optional, unix timestamp)",
  "urgency": "normal | fast | urgent (optional)"
}
```

**Response Schema**:
```json
{
  "requestId": "string",
  "swap": {
    "to": "string (contract address)",
    "from": "string (sender address)",
    "data": "string (transaction calldata)",
    "value": "string (ETH value in wei)",
    "gasLimit": "string",
    "chainId": "number",
    "maxFeePerGas": "string",
    "maxPriorityFeePerGas": "string"
  },
  "gasFee": "string (estimated gas cost)"
}
```

**Characteristics**:
- "Gasful" - customer pays gas
- Customer writes transaction to chain
- Used for classic Uniswap pools (V2/V3/V4)
- Used for bridges and token wrap/unwrap

**Error Codes**: 400, 401, 404, 419, 500, 504

---

### 4. Create Gasless Order - `/order`

**Purpose**: Submit UniswapX gasless order to filler network

**Method**: `POST`

**When to Use**: When quote `routing` field is `DUTCH_V2`, `DUTCH_V3`, or `PRIORITYQUOTE`

**Request Schema**:
```json
{
  "signature": "string (signed permit, required)",
  "quote": "object (Dutch Quote V2/V3 or Priority Quote, required)",
  "routing": "DUTCH_V2 | DUTCH_V3 | PRIORITYQUOTE (required)"
}
```

**Quote Object Contains**:
```json
{
  "encodedOrder": "string",
  "orderId": "string",
  "orderInfo": {
    "chainId": "number",
    "nonce": "string",
    "reactor": "string (contract address)",
    "swapper": "string (wallet address)",
    "deadline": "number",
    "input": {
      "token": "string",
      "amount": "string"
    },
    "outputs": "array"
  },
  "quoteId": "string",
  "slippageTolerance": "string",
  "portionBips": "number",
  "portionAmount": "string"
}
```

**Response Schema**:
```json
{
  "requestId": "string",
  "orderId": "string",
  "orderStatus": "open | filled | expired | error | cancelled | insufficient-funds"
}
```

**Order Lifecycle**:
- `open`: Not yet filled
- `filled`: Successfully completed
- `expired`: Unfilled past deadline
- `cancelled`: Manually cancelled
- `error`: Unspecified failure
- `insufficient-funds`: Cannot complete due to lack of funds

**Characteristics**:
- "Gasless" - filler pays gas
- Filled by RFQ market maker
- Order decays from startAmount to endAmount over time
- Remains open until filled, cancelled, or expired

**Error Codes**: 400, 401, 419, 500, 504

---

### 5. Create Batch Swap - `/swap_5792`

**Purpose**: Create EIP-5792 calldata for batch swap transactions

**Method**: `POST`

**Request Schema**:
```json
{
  "quote": "ClassicQuote | WrapUnwrapQuote | BridgeQuote (required)",
  "permitData": "object (optional, Permit2 message)",
  "deadline": "number (optional, unix timestamp)",
  "urgency": "normal | fast | urgent (optional)"
}
```

**Response Schema**:
```json
{
  "requestId": "string",
  "from": "string (sender wallet address)",
  "chainId": "number",
  "calls": [
    {
      "to": "string",
      "data": "string",
      "value": "string"
    }
  ],
  "gasFee": "string"
}
```

**Features**:
- Supports complex swap scenarios
- Multi-route swap capabilities
- Precise gas estimation
- Requires Universal Router compatibility

---

### 6. Check Order Status - `/orders` (GET)

**Purpose**: Retrieve one or more gasless orders by filters

**Method**: `GET`

**Query Parameters** (at least one required):
- `orderId`: Single order ID
- `orderIds`: Comma-separated order IDs
- `orderStatus`: Filter by status (open, filled, etc.)
- `swapper`: Filter by swapper address
- `filler`: Filter by filler address

**Response**: Order details with current status

**Alternative**: Register webhooks for real-time order notifications (lower latency than polling)

---

## Quote vs Execute Flow

### The 2-Step Process

#### Step 1: Get Quote
```
POST /quote
```
- Provides swap parameters
- Receives quote with routing information
- Quote includes `routing` field that determines next step

#### Step 2: Execute Based on Routing

**If `routing` is `CLASSIC` or `BRIDGE`**:
```
POST /swap
```
- "Gasful" transaction
- Customer pays gas and writes to chain
- Used for: V2/V3/V4 pools, bridges, wrap/unwrap

**If `routing` is `DUTCH_V2`, `DUTCH_V3`, or `PRIORITYQUOTE`**:
```
POST /order
```
- "Gasless" transaction
- Filler pays gas and writes to chain
- Used for: UniswapX private liquidity

### Complete Workflow

```
1. Check Approval (if needed)
   POST /check_approval
   └─> Submit approval transaction (if returned)

2. Request Quote
   POST /quote
   └─> Receive quote with routing type

3. Sign Permit (if permitData present)
   └─> Sign EIP-712 structured data

4. Execute Swap or Order
   If routing = CLASSIC/BRIDGE:
     POST /swap
     └─> Submit transaction on-chain

   If routing = DUTCH_V2/DUTCH_V3/PRIORITYQUOTE:
     POST /order
     └─> Order submitted to filler network
     └─> Monitor order status

5. Monitor Transaction/Order
   - For /swap: Monitor on-chain transaction
   - For /order: Poll /orders or use webhooks
```

---

## Approval & Permit2

### What is Permit2?

Permit2 is Uniswap's next-generation token approval mechanism that:
- Provides gasless token approvals via signatures
- Enables one-time approvals for specific amounts
- Supports both EOA and contract signatures (EIP-1271)
- Uses EIP-712 for structured data signing

### Approval Flow

#### 1. Check Current Approval
```json
POST /check_approval
{
  "walletAddress": "0x...",
  "token": "0x...",
  "amount": "1000000000000000000",
  "chainId": 1
}
```

#### 2. Handle Response

**Case A: Sufficient Approval**
```json
{
  "requestId": "...",
  "approval": null  // No action needed
}
```

**Case B: Need Approval**
```json
{
  "requestId": "...",
  "approval": {
    "to": "0x...",
    "data": "0x...",
    "chainId": 1,
    "gasLimit": "50000"
  },
  "gasFee": "..."
}
```
→ Submit approval transaction on-chain

**Case C: Need to Reset Approval**
```json
{
  "requestId": "...",
  "cancel": {
    "to": "0x...",
    "data": "0x..."
  },
  "approval": {
    "to": "0x...",
    "data": "0x..."
  }
}
```
→ Submit cancel transaction first, then approval transaction

### Permit2 Signing

When quote response includes `permitData`:

```json
{
  "permitData": {
    "domain": {
      "name": "Permit2",
      "chainId": 1,
      "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    },
    "types": {
      "PermitTransferFrom": [...],
      "TokenPermissions": [...]
    },
    "values": {
      "permitted": {...},
      "spender": "0x...",
      "nonce": "...",
      "deadline": "..."
    }
  }
}
```

#### Sign with ethers.js
```javascript
import { ethers } from 'ethers';

const signature = await signer._signTypedData(
  permitData.domain,
  permitData.types,
  permitData.values
);
```

#### Sign with Fireblocks
```python
from fireblocks_sdk import FireblocksSDK

typed_message = {
    "domain": permitData["domain"],
    "types": permitData["types"],
    "primaryType": "PermitTransferFrom",
    "message": permitData["values"]
}

signature = fireblocks.sign_typed_message(
    vault_account_id,
    typed_message
)
```

### Permit2 vs Traditional Approval

| Traditional Approval | Permit2 |
|---------------------|---------|
| Requires on-chain transaction | Can use off-chain signature |
| Unlimited approval common | Specific amount approval |
| Costs gas | Gasless (signature only) |
| One approval per token/spender | Flexible approval management |

---

## Supported Chains & Tokens

### Mainnet Chains (11)

| Chain | Chain ID | UniswapX Support |
|-------|----------|------------------|
| Ethereum | 1 | V2 ✓ |
| OP Mainnet | 10 | - |
| BNB Smart Chain | 56 | - |
| Polygon | 137 | - |
| zkSync | 324 | - |
| Base | 8453 | V2 ✓ |
| Arbitrum | 42161 | V2 ✓, V3 ✓ |
| Celo | 42220 | - |
| Avalanche | 43114 | - |
| Blast | 81457 | - |
| Zora | 7777777 | - |

### Additional Chains

| Chain | Chain ID | Notes |
|-------|----------|-------|
| Unichain | 130 | UniswapX V2 ✓ |
| World Chain | 480 | - |
| Soneium | 1868 | - |

### Testnet Chains (3)

| Chain | Chain ID |
|-------|----------|
| Unichain Sepolia | 1301 |
| Monad Testnet | 10143 |
| Ethereum Sepolia | 11155111 |

### UniswapX Restrictions

- **UniswapX V2**: Ethereum (1), Arbitrum (42161), Base (8453), Unichain (130)
- **UniswapX V3**: Arbitrum (42161) only
- **L2 Minimum**: All UniswapX L2 orders require minimum 300 USDC-equivalent value

### Cross-Chain Support

- Quotes support different `tokenInChainId` and `tokenOutChainId`
- Bridge routing available for cross-chain swaps
- Routing type will be `BRIDGE` for cross-chain quotes

### Token Support

- Thousands of onchain assets supported
- Common tokens: ETH, WETH, USDC, USDT, WBTC, DAI
- Token wrap/unwrap supported (ETH <-> WETH)
- Recommend submitting quote request to confirm token pair availability

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Request validation error - malformed parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 404 | Not Found | Endpoint or resource doesn't exist |
| 419 | Rate Limited | Exceeded rate limit (see Rate Limiting section) |
| 500 | Internal Server Error | Server-side error |
| 504 | Gateway Timeout | Request timed out |

### Common Error Scenarios

#### Quote Failures

**No Route Available**
```json
{
  "error": "NO_ROUTE_FOUND",
  "message": "No route found for the specified token pair"
}
```
**Action**: Retry with different protocols or check token addresses

**Insufficient Liquidity**
```json
{
  "error": "INSUFFICIENT_LIQUIDITY",
  "message": "Insufficient liquidity for the requested amount"
}
```
**Action**: Reduce swap amount or modify slippage tolerance

**Slippage Exceeded**
```json
{
  "error": "SLIPPAGE_EXCEEDED",
  "message": "Price impact exceeds slippage tolerance"
}
```
**Action**: Increase slippage tolerance or reduce amount

#### Order Failures

**Order Status: `insufficient-funds`**
- Wallet lacks sufficient balance
- Token approval insufficient

**Order Status: `expired`**
- Order not filled before deadline
- Consider adjusting deadline or slippage

**Order Status: `error`**
- Unspecified failure
- Check order details and retry

### Error Handling Best Practices

1. **Retry Logic**
   - For 419 (rate limited): Implement exponential backoff
   - For 500/504: Retry with delay
   - For quote failures: Modify parameters and retry

2. **Parameter Adjustment**
   ```javascript
   // Example retry logic
   async function getQuoteWithRetry(params, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await getQuote(params);
       } catch (error) {
         if (error.code === 'INSUFFICIENT_LIQUIDITY') {
           // Reduce amount by 10%
           params.amount = (BigInt(params.amount) * 90n / 100n).toString();
         } else if (error.code === 'SLIPPAGE_EXCEEDED') {
           // Increase slippage
           params.slippageTolerance = (parseFloat(params.slippageTolerance) + 0.5).toString();
         } else {
           throw error;
         }
       }
     }
   }
   ```

3. **Validation Before Submission**
   - Verify token addresses and chain IDs
   - Ensure amounts are in base units (not decimals)
   - Check wallet has sufficient balance
   - Confirm approval is in place

4. **Simulation**
   - Quotes are automatically simulated
   - Use `simulateTransaction: true` in /swap request
   - Note: Simulation is not a guarantee of success

---

## Rate Limiting

### Default Rate Limit

**12 requests per second per API key**

### Rate Limit Headers

When rate limited, you'll receive:
- HTTP Status: `419`
- Standard rate limit headers (if provided)

### Increasing Rate Limits

- Contact Uniswap Labs to request higher limits
- Reach out to account manager or support
- Provide use case and expected volume

### Rate Limit Best Practices

1. **Implement Backoff**
   ```javascript
   async function apiCallWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.status === 419 && i < maxRetries - 1) {
           const delay = Math.pow(2, i) * 1000; // Exponential backoff
           await new Promise(resolve => setTimeout(resolve, delay));
         } else {
           throw error;
         }
       }
     }
   }
   ```

2. **Request Batching**
   - Use `/swap_5792` for batch operations
   - Combine multiple swaps when possible

3. **Caching**
   - Cache quote results briefly (quotes refresh on each request)
   - Don't cache approvals - always check current state

4. **Optimize Calls**
   - Only call `/check_approval` when necessary
   - Reuse quotes within their validity period
   - Don't poll excessively - use webhooks for order status

---

## Transaction Monitoring

### For Protocol Swaps (`/swap`)

After receiving swap response, monitor on-chain:

```javascript
// Example with ethers.js
const txResponse = await signer.sendTransaction({
  to: swapResponse.swap.to,
  data: swapResponse.swap.data,
  value: swapResponse.swap.value,
  gasLimit: swapResponse.swap.gasLimit,
  maxFeePerGas: swapResponse.swap.maxFeePerGas,
  maxPriorityFeePerGas: swapResponse.swap.maxPriorityFeePerGas
});

// Wait for confirmation
const receipt = await txResponse.wait();
console.log('Transaction confirmed:', receipt.transactionHash);
```

### For UniswapX Orders (`/order`)

#### Option 1: Polling (Higher Latency)

```javascript
async function pollOrderStatus(orderId) {
  const maxAttempts = 60; // 5 minutes with 5s intervals

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://trade-api.gateway.uniswap.org/v1/orders?orderId=${orderId}`,
      {
        headers: { 'x-api-key': API_KEY }
      }
    );

    const order = await response.json();

    if (order.orderStatus === 'filled') {
      console.log('Order filled!');
      return order;
    } else if (['expired', 'cancelled', 'error'].includes(order.orderStatus)) {
      console.log('Order failed:', order.orderStatus);
      return order;
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

#### Option 2: Webhooks (Lower Latency)

Register webhook endpoint to receive order notifications:
- Real-time updates when orders are posted/filled
- Filter orders by criteria
- Lower latency than polling
- Recommended for production systems

**Webhook Setup**:
- Contact Uniswap Labs to register endpoint
- Implement webhook handler to receive notifications
- Validate webhook signatures for security

### Order Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `open` | Order submitted, awaiting fill | Continue monitoring |
| `filled` | Successfully completed | Verify final amounts |
| `expired` | Unfilled past deadline | Consider resubmitting |
| `cancelled` | Manually cancelled | - |
| `error` | Unspecified failure | Check details and retry |
| `insufficient-funds` | Lacks balance | Add funds and retry |

### Query Parameters for Order Status

```
GET /orders?orderId={orderId}
GET /orders?orderIds={id1,id2,id3}
GET /orders?swapper={address}
GET /orders?orderStatus=open
GET /orders?filler={address}
```

At least one parameter required.

---

## Best Practices

### 1. Integration Timeline

- **Estimated Time**: Less than 2 weeks for full integration
- Review OAS (OpenAPI Specification) documentation
- Use provided sample code as starting point

### 2. Quote Management

**Always Request Fresh Quotes**
- Quotes refresh on each request
- Don't reuse old quotes
- Submit quote request before every swap to confirm route

**Use Automatic Slippage**
- Recommended over manual slippage settings
- Adjusts based on market conditions
- Reduces failed transactions

**Quote Expiration**
- Quotes include deadline field
- Don't submit expired quotes
- Request new quote if too much time has passed

### 3. Protocol Selection

**Specify All Acceptable Protocols**
```json
{
  "protocols": ["V2", "V3", "V4", "UNISWAPX_V2"],
  "routingPreference": "BEST_PRICE"
}
```

**Don't Mix UniswapX Versions**
- Use either `UNISWAPX_V2` OR `UNISWAPX_V3`, not both
- V3 only available on Arbitrum
- V2 available on Ethereum, Arbitrum, Base, Unichain

**Routing Preferences**
- `BEST_PRICE`: Optimal pricing (recommended for most cases)
- `FASTEST`: Quickest execution, excludes private liquidity

### 4. Approval Management

**Check Before Every Swap**
- Always call `/check_approval` first
- Token approvals can change
- Handle approval resets properly

**Submit Cancel Before New Approval**
- Some tokens require approval reset
- If `cancel` is present, execute it first
- Wait for cancel confirmation before submitting approval

**Permit2 Benefits**
- Use Permit2 signatures when available
- Reduces gas costs
- Safer than unlimited approvals

### 5. Error Handling

**Implement Robust Retry Logic**
- Exponential backoff for rate limits
- Parameter adjustment for quote failures
- Maximum retry limits to prevent infinite loops

**Quote Failure Recovery**
```
If quote fails:
1. Check failure reason
2. Adjust parameters:
   - Reduce amount for liquidity issues
   - Increase slippage for price impact
   - Try different protocols
3. Retry with modified parameters
```

**Transaction Simulation**
- Quotes are automatically simulated
- Use simulation results to catch issues early
- Remember: Simulation ≠ Guarantee

### 6. Gas Optimization

**Use Urgency Parameter**
- `normal`: Lower gas, slower execution
- `fast`: Moderate gas and speed
- `urgent`: Higher gas, faster execution (default for approvals)

**Batch Operations**
- Use `/swap_5792` for multiple swaps
- Reduces total gas costs
- Requires EIP-5792 compatible wallet

**UniswapX for Gas Savings**
- UniswapX orders are gasless
- Filler pays gas fees
- Best for larger trades (>300 USDC on L2s)

### 7. Security

**API Key Management**
- Never expose API keys in client-side code
- Use environment variables
- Rotate keys periodically
- Implement key usage monitoring

**Transaction Verification**
- Always verify quote details before signing
- Check token addresses match expectations
- Verify amounts and recipients
- Validate chain IDs

**Signature Security**
- Use hardware wallets for production
- Implement transaction approval workflows
- Validate EIP-712 domain before signing
- Never sign unknown data structures

### 8. Monitoring & Observability

**Track Key Metrics**
- Quote success rate
- Order fill rate
- Average fill time
- Gas costs
- Slippage actual vs expected

**Logging**
- Log all API requests and responses
- Include requestId in logs
- Monitor error rates by type
- Track rate limit usage

**Alerting**
- Alert on high error rates
- Monitor unfilled orders
- Track unusual gas costs
- Watch for API downtime

### 9. Production Deployment

**Use Beta Environment First**
- Test with beta endpoint
- Validate all flows
- Performance testing
- Then migrate to production

**Gradual Rollout**
- Start with small amounts
- Monitor closely
- Gradually increase limits
- Have rollback plan

**Failover Strategy**
- Handle API downtime gracefully
- Implement circuit breakers
- Have backup liquidity sources
- Queue failed requests for retry

### 10. Order Management (UniswapX)

**Set Appropriate Deadlines**
- Balance fill speed vs success rate
- Longer deadlines increase fill probability
- Consider market volatility

**Monitor Order Decay**
- Orders decay from startAmount to endAmount
- Understand decay curve
- Factor into pricing expectations

**Webhook vs Polling**
- Use webhooks for production
- Lower latency than polling
- More efficient
- Easier to scale

### 11. Cross-Chain Swaps

**Verify Chain IDs**
- Double-check source and destination chains
- Ensure wallets control addresses on both chains
- Account for bridge delays

**Bridge Considerations**
- Cross-chain swaps use bridge routing
- Longer execution times
- Additional fees may apply
- Verify bridge security

### 12. Testing Recommendations

**Test Cases**
- Successful swap flow
- Approval required
- Approval reset required
- Quote failures (no route, insufficient liquidity)
- Rate limiting
- Order expiration
- Cross-chain swaps
- Large amounts (slippage)
- Small amounts (gas optimization)

**Use Testnets**
- Unichain Sepolia (1301)
- Ethereum Sepolia (11155111)
- Test full workflows without real funds

---

## Code Examples

### Complete Swap Flow (TypeScript/Ethers)

```typescript
import { ethers } from 'ethers';
import axios from 'axios';

const API_KEY = process.env.UNISWAP_API_KEY;
const API_BASE = 'https://trade-api.gateway.uniswap.org/v1';

async function executeSwap(
  signer: ethers.Signer,
  tokenIn: string,
  tokenOut: string,
  amount: string,
  chainId: number
) {
  const swapperAddress = await signer.getAddress();

  // 1. Check approval
  const approvalResponse = await axios.post(
    `${API_BASE}/check_approval`,
    {
      walletAddress: swapperAddress,
      token: tokenIn,
      amount,
      chainId
    },
    {
      headers: { 'x-api-key': API_KEY }
    }
  );

  // 2. Handle approval if needed
  if (approvalResponse.data.approval) {
    // Submit cancel if present
    if (approvalResponse.data.cancel) {
      const cancelTx = await signer.sendTransaction(approvalResponse.data.cancel);
      await cancelTx.wait();
    }

    // Submit approval
    const approvalTx = await signer.sendTransaction(approvalResponse.data.approval);
    await approvalTx.wait();
  }

  // 3. Get quote
  const quoteResponse = await axios.post(
    `${API_BASE}/quote`,
    {
      type: 'EXACT_INPUT',
      amount,
      tokenInChainId: chainId,
      tokenOutChainId: chainId,
      tokenIn,
      tokenOut,
      swapper: swapperAddress,
      slippageTolerance: 'auto',
      protocols: ['V2', 'V3', 'V4', 'UNISWAPX_V2']
    },
    {
      headers: { 'x-api-key': API_KEY }
    }
  );

  const { quote, routing, permitData } = quoteResponse.data;

  // 4. Sign permit if needed
  let signature;
  if (permitData) {
    signature = await signer._signTypedData(
      permitData.domain,
      permitData.types,
      permitData.values
    );
  }

  // 5. Execute based on routing
  if (routing === 'CLASSIC' || routing === 'BRIDGE') {
    // Protocol swap
    const swapResponse = await axios.post(
      `${API_BASE}/swap`,
      {
        quote,
        signature,
        permitData
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );

    // Submit transaction
    const tx = await signer.sendTransaction(swapResponse.data.swap);
    const receipt = await tx.wait();

    return {
      type: 'swap',
      transactionHash: receipt.transactionHash
    };
  } else {
    // UniswapX order
    const orderResponse = await axios.post(
      `${API_BASE}/order`,
      {
        signature,
        quote,
        routing
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );

    return {
      type: 'order',
      orderId: orderResponse.data.orderId,
      orderStatus: orderResponse.data.orderStatus
    };
  }
}
```

### Monitor Order Status

```typescript
async function monitorOrder(orderId: string): Promise<void> {
  const maxAttempts = 60;
  const pollInterval = 5000; // 5 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(
      `${API_BASE}/orders`,
      {
        params: { orderId },
        headers: { 'x-api-key': API_KEY }
      }
    );

    const status = response.data.orderStatus;
    console.log(`Order ${orderId} status: ${status}`);

    if (status === 'filled') {
      console.log('Order successfully filled!');
      return;
    }

    if (['expired', 'cancelled', 'error', 'insufficient-funds'].includes(status)) {
      throw new Error(`Order failed with status: ${status}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Order monitoring timeout');
}
```

---

## Summary

### Key Takeaways

1. **Authentication**: Use `x-api-key` header for all requests
2. **Two-Step Flow**: Quote → Execute (swap or order based on routing)
3. **Approval Management**: Always check approvals, use Permit2 when possible
4. **Routing Types**: CLASSIC/BRIDGE → /swap, DUTCH/PRIORITY → /order
5. **Rate Limits**: 12 req/sec default, contact for higher limits
6. **Error Handling**: Implement retries with parameter adjustment
7. **Monitoring**: On-chain for swaps, webhooks/polling for orders
8. **Best Practices**: Fresh quotes, automatic slippage, robust error handling

### API Endpoints Quick Reference

| Endpoint | Method | Purpose | When to Use |
|----------|--------|---------|-------------|
| `/check_approval` | POST | Check token approval | Before first swap with token |
| `/quote` | POST | Get swap quote | Every swap |
| `/swap` | POST | Execute protocol swap | When routing = CLASSIC/BRIDGE |
| `/order` | POST | Submit UniswapX order | When routing = DUTCH_*/PRIORITY |
| `/swap_5792` | POST | Batch swap | EIP-5792 batch operations |
| `/orders` | GET | Check order status | Monitor UniswapX orders |

### Integration Checklist

- [ ] Obtain API key from hub.uniswap.org
- [ ] Set up authentication with x-api-key header
- [ ] Implement approval checking
- [ ] Build quote request logic
- [ ] Handle both swap and order execution paths
- [ ] Implement Permit2 signature signing
- [ ] Add error handling and retry logic
- [ ] Set up transaction/order monitoring
- [ ] Test on testnet (Sepolia)
- [ ] Implement rate limit handling
- [ ] Add logging and metrics
- [ ] Deploy to production with gradual rollout

### Support & Resources

- **API Documentation**: https://api-docs.uniswap.org/
- **Get API Key**: https://hub.uniswap.org/
- **Code Examples**: https://api-docs.uniswap.org/guides/swapping_code_examples
- **Support**: Contact via account manager or helpdesk
- **Beta Environment**: https://beta.trade-api.gateway.uniswap.org/v1

---

**Document Version**: 1.0
**Last Updated**: 2025-01-14
**Based on**: Uniswap Trading API v1 Documentation
