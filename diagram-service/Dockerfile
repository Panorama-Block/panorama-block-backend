FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

EXPOSE 3010
CMD ["node", "dist/index.js"]
