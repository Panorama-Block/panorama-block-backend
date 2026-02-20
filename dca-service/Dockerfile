FROM node:18-alpine AS builder

WORKDIR /app

# Native deps (thirdweb/metamask deps include native modules like bufferutil)
RUN apk add --no-cache python3 py3-setuptools make g++

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies after building to keep image lean
RUN npm prune --omit=dev

# Runtime stage (keeps image lean, no build toolchain)
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/schema.sql ./schema.sql

EXPOSE 3007

CMD ["npm", "start"]
