FROM node:18-alpine AS builder

WORKDIR /app

# Native deps (some transitive deps include node-gyp builds like utf-8-validate)
RUN apk add --no-cache python3 py3-setuptools make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Remove dev dependencies after building to keep image lean
RUN npm prune --omit=dev

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/index.js"]
