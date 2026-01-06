FROM node:18-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies for prisma generate)
RUN npm install

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3003

# Run the application
CMD ["npm", "start"]
