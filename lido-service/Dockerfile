FROM node:18-alpine AS builder

WORKDIR /app

# Native deps (thirdweb/metamask deps include native modules like bufferutil)
RUN apk add --no-cache python3 py3-setuptools make g++

# Copy package files
COPY package*.json ./

# Install dependencies (avoid lock mismatches when package.json changes)
RUN npm install

# Copy source code
COPY . .

# Build the application
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

# Expose port
EXPOSE 3004

# Start the application
CMD ["npm", "start"]
