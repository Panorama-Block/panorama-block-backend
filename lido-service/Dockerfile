FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for the build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after building to keep image lean
RUN npm prune --omit=dev

# Expose port
EXPOSE 3004

# Start the application
CMD ["npm", "start"]
