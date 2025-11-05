# syntax=docker/dockerfile:1

ARG DATABASE_URL="postgresql://postgres:postgres@postgres:5432/panorama_db?schema=public"

FROM node:20-slim AS base
WORKDIR /app

COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install

FROM base AS build
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY tsconfig.json tsconfig.json
COPY prisma prisma
COPY apps apps
COPY packages packages
COPY tooling tooling

RUN npm run prisma:generate
RUN npm run build

FROM node:20-slim AS runtime
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --omit=dev
COPY prisma prisma
RUN npm run prisma:generate

COPY --from=build /app/dist dist

EXPOSE 8080
CMD ["node", "dist/apps/gateway/src/main.js"]
