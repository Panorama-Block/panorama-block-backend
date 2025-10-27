# Deployment Guide - Multi-Provider Swap System

## Quick Start

This guide walks through deploying the liquid-swap-service with multi-provider support (Uniswap + Thirdweb).

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Thirdweb API credentials
- PostgreSQL database (for swap history - optional)
- Redis (for caching - optional)

## Environment Setup

### 1. Core Configuration

Create `.env` file in the project root:

```bash
# Server
PORT=3001
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://your-miniapp-domain.com

# Thirdweb (Required)
THIRDWEB_CLIENT_ID=your_client_id_here
THIRDWEB_SECRET_KEY=your_secret_key_here

# Uniswap (Optional - enabled by default)
UNISWAP_ENABLED=true

# Supported Chains
SUPPORTED_CHAINS=1,137,56,8453,10,42161,43114

# Debug & Logging
DEBUG=false
LOG_LEVEL=info
```

### 2. Optional Features

```bash
# Database (for swap history)
DATABASE_URL=postgresql://user:password@localhost:5432/swaps

# Redis (for caching quotes)
REDIS_URL=redis://localhost:6379

# Engine Execution (server-side transaction signing)
ENGINE_ENABLED=false
ADMIN_WALLET_ADDRESS=0x...
ENGINE_API_URL=https://...
ENGINE_ACCESS_TOKEN=...

# Monitoring
SENTRY_DSN=https://...
```

### 3. Chain-Specific RPC URLs (Optional - improves performance)

```bash
# Mainnet
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Add more as needed
```

## Installation

### 1. Install Dependencies

```bash
cd panorama-block-backend/liquid-swap-service
npm install
```

### 2. Run Tests

```bash
# Unit tests (should show 20/20 passing)
npm test

# Integration tests (optional)
npx ts-node test-integration.ts
```

Expected output:
```
Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
```

### 3. Build for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Deployment Options

### Option A: Traditional Node.js Deployment

```bash
# Start production server
npm start

# Or with PM2 for process management
pm2 start dist/index.js --name liquid-swap-service
pm2 save
pm2 startup
```

### Option B: Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist
COPY .env .env

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build Docker image
docker build -t liquid-swap-service .

# Run container
docker run -d \
  --name liquid-swap-service \
  -p 3001:3001 \
  --env-file .env \
  liquid-swap-service
```

### Option C: Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  liquid-swap-service:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  # Optional: PostgreSQL for swap history
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: swaps
      POSTGRES_USER: swapuser
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Deploy:

```bash
docker-compose up -d
```

## Health Checks

### 1. Service Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T10:30:00.000Z",
  "providers": {
    "uniswap": "enabled",
    "thirdweb": "enabled"
  }
}
```

### 2. Provider Status

Test quote endpoint:

```bash
curl -X POST http://localhost:3001/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 1,
    "toChainId": 1,
    "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "0.01",
    "smartAccountAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }'
```

Check response includes `"provider": "uniswap"` or `"provider": "thirdweb"`.

## Monitoring Setup

### 1. Application Logs

**Production logging configuration**:

```javascript
// In src/config/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### 2. Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **Provider Success Rate** | % successful quotes per provider | < 95% |
| **Fallback Rate** | % swaps using fallback provider | > 20% |
| **Response Time (p95)** | 95th percentile API response time | > 2000ms |
| **Error Rate** | % failed requests | > 5% |
| **Quote→Execute Conversion** | % quotes that become swaps | Monitor trend |

### 3. Logging Queries

**Find provider distribution**:
```bash
grep "Auto-selected provider" combined.log | \
  awk '{print $NF}' | \
  sort | uniq -c
```

**Find fallback occurrences**:
```bash
grep "fallback" combined.log | wc -l
```

**Find errors by provider**:
```bash
grep "Uniswap failed" error.log
grep "Thirdweb failed" error.log
```

## Frontend Configuration

### MiniApp Environment

Update `telegram/apps/miniapp/.env`:

```bash
# Swap API
VITE_SWAP_API_BASE=https://your-api-domain.com

# Or via Gateway
VITE_GATEWAY_BASE=https://your-gateway-domain.com

# Thirdweb (for wallet connections)
VITE_THIRDWEB_CLIENT_ID=your_client_id_here
```

### Verify Frontend Integration

1. Open MiniApp in browser
2. Navigate to swap page
3. Enter swap details
4. Check Quote Details section shows "Provider: Uniswap" or "Provider: Thirdweb"
5. Verify provider badge is highlighted in blue

## Rollback Procedure

If issues occur after deployment:

### Quick Rollback

```bash
# With PM2
pm2 stop liquid-swap-service
pm2 start previous-version

# With Docker
docker stop liquid-swap-service
docker run -d --name liquid-swap-service <previous-image>

# With Docker Compose
docker-compose down
git checkout <previous-commit>
docker-compose up -d
```

### Disable Uniswap Provider

If Uniswap causes issues, disable it temporarily:

```bash
# Set environment variable
UNISWAP_ENABLED=false

# Restart service
pm2 restart liquid-swap-service
```

System will automatically use Thirdweb for all swaps.

## Performance Tuning

### 1. Quote Caching (Optional)

Implement Redis caching for quotes:

```typescript
// src/infrastructure/cache/quote.cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const QUOTE_TTL = 30; // seconds

export async function getCachedQuote(key: string) {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheQuote(key: string, quote: any) {
  await redis.setex(key, QUOTE_TTL, JSON.stringify(quote));
}
```

### 2. Connection Pooling

For high traffic, configure connection pooling:

```typescript
// src/infrastructure/adapters/uniswap.swap.adapter.ts
this.axios = axios.create({
  baseURL: this.baseURL,
  timeout: 10000,
  maxRedirects: 5,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});
```

### 3. Rate Limiting

Protect against abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/swap', limiter);
```

## Security Checklist

- [ ] HTTPS enabled on all endpoints
- [ ] CORS configured with specific allowed origins
- [ ] API keys stored in environment variables (not code)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose sensitive info
- [ ] Logging doesn't include private keys or secrets
- [ ] Database credentials rotated regularly
- [ ] SSL certificates valid and auto-renewing

## Troubleshooting

### Issue: Service won't start

**Check**:
```bash
# Verify environment variables loaded
env | grep THIRDWEB

# Check logs
tail -f combined.log

# Verify dependencies installed
npm list | grep thirdweb
```

### Issue: All quotes using Thirdweb (Uniswap not working)

**Debug steps**:
```bash
# Check Uniswap is enabled
grep "UNISWAP_ENABLED" .env

# Check logs for Uniswap errors
grep "UniswapAPI" combined.log | grep "❌"

# Test Uniswap API directly
curl https://trade-api.gateway.uniswap.org/v1/quote \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"type":"EXACT_INPUT","amount":"1000000",...}'
```

### Issue: Frontend not showing provider

**Check**:
1. Browser console for errors
2. Network tab - verify API response includes `provider` field
3. TypeScript compilation errors in MiniApp
4. Quote component properly rendering provider badge

## Maintenance

### Regular Tasks

**Daily**:
- Monitor error logs
- Check provider success rates
- Verify health check endpoint

**Weekly**:
- Review fallback rate trends
- Analyze provider performance
- Check for dependency updates

**Monthly**:
- Review and rotate API keys
- Update dependencies (security patches)
- Analyze cost vs performance metrics

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update non-breaking changes
npm update

# Test after updates
npm test

# Update major versions carefully
npm install thirdweb@latest
npm test
```

## Support Contacts

- **Uniswap API Issues**: https://support.uniswap.org
- **Thirdweb Support**: https://thirdweb.com/support
- **Internal Team**: [Your support channel]

## Appendix: Complete Environment Variables Reference

```bash
# === REQUIRED ===
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=

# === OPTIONAL ===
# Server
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=

# Providers
UNISWAP_ENABLED=true

# Chains
SUPPORTED_CHAINS=1,137,56,8453,10,42161,43114

# Database
DATABASE_URL=

# Cache
REDIS_URL=

# Engine
ENGINE_ENABLED=false
ADMIN_WALLET_ADDRESS=
ENGINE_API_URL=
ENGINE_ACCESS_TOKEN=

# Monitoring
DEBUG=false
LOG_LEVEL=info
SENTRY_DSN=

# RPC URLs (optional but recommended)
RPC_URL_1=
RPC_URL_137=
RPC_URL_8453=
RPC_URL_10=
RPC_URL_42161=
RPC_URL_43114=
RPC_URL_56=
```

## Next Steps

After successful deployment:

1. ✅ Monitor logs for 24 hours
2. ✅ Track provider usage distribution
3. ✅ Measure quote response times
4. ✅ Gather user feedback on provider display
5. ✅ Consider adding more providers (1inch, 0x)
6. ✅ Implement quote caching for performance
7. ✅ Set up automated alerts for high error rates

---

**Deployment Date**: _____________

**Deployed By**: _____________

**Version**: 1.0.0 (Multi-Provider)

**Status**: ⬜ Planning ⬜ Testing ⬜ Deployed ⬜ Verified
