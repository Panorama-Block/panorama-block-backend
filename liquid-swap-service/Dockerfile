FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3003

# Run the application
CMD ["npm", "start"] 