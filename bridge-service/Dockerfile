# Build stage
FROM node:18-bullseye-slim AS builder

# Add OpenSSL for Prisma + CA certs
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install to avoid lock mismatches in envs without updated lockfile)
RUN npm install --only=production

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-bullseye-slim AS production

# Add OpenSSL for Prisma + CA certs
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 tacservice

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=tacservice:nodejs /app/dist ./dist
COPY --from=builder --chown=tacservice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=tacservice:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p /app/logs && chown -R tacservice:nodejs /app/logs

# Switch to non-root user
USER tacservice

# Expose ports
EXPOSE 3005 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]

# Development stage
FROM node:18-bullseye-slim AS development

# Add OpenSSL for Prisma + CA certs
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install development dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose ports
EXPOSE 3005 3006

# Start development server
CMD ["npm", "run", "dev"]
