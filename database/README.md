# Panorama Data Gateway

Hexagonal Fastify + Prisma gateway that exposes safe CRUD + transaction endpoints for all Panorama data entities. The service enforces multi-tenancy, idempotency, and writes outbox records so downstream processors can emit events reliably.

## Features
- Generic REST interface (`/v1/:entity`) covering list/get/create/update/delete plus `_transact` batch ops.
- Multi-tenant enforcement via `x-tenant-id` header (or JWT tenant claim).
- JWT service-to-service authentication with role-aware authorization.
- Outbox table populated for every write, and Idempotency-Key replay support for POST/PATCH/DELETE and `_transact`.
- Prisma adapter wired through RepositoryPort to keep the domain independent from infrastructure.
- Vitest + Supertest test suite covering the `users`, `messages`, and `conversations` endpoints.

## Project Layout
```
apps/
  gateway/
    src/
      config.ts
      main.ts
      http/
        app.ts
        handlers/
        middlewares/
        schemas/
    test/
packages/
  core/        # entity metadata, ports, services
  infra-prisma # Prisma repository + outbox + idempotency stores
  auth/        # JWT plugin
  validation/  # query parsing helpers
  observability/
  queue/
prisma/
  schema.prisma
tooling/
  scripts/seed.ts
```

## Getting Started
1. Install dependencies (requires Node 20+):
   ```bash
   npm install
   ```
2. Copy environment variables and supply secrets:
   ```bash
   cp .env.example .env
   # set DATABASE_URL, JWT_SECRET, optional JWT_AUDIENCE/JWT_ISSUER
   ```
3. Start Postgres:
   ```bash
   docker compose up postgres -d
   ```
4. Apply the schema and generate the Prisma client:
   ```bash
   npm run prisma:generate
   npm run migrate:dev -- --name init-gateway
   ```
5. Seed demo data (optional):
   ```bash
   npx ts-node tooling/scripts/seed.ts
   ```
6. Launch the gateway:
   ```bash
   npm run dev
   ```
   Service listens on `http://localhost:8080` by default.

## Authentication & Tenancy
- Every request (except `/health`) must send `Authorization: Bearer <jwt>`.
- JWT must be signed with `JWT_SECRET`; supply `roles`, `service`, and optional `tenant` claim.
- Requests must also include `x-tenant-id`. If both header and JWT contain a tenant they must match.

### Idempotency
- For `POST`, `PATCH`, `DELETE`, and `_transact` calls send an `Idempotency-Key` header.
- The gateway hashes the request (method + path + tenant + payload); a matching key replays the stored response with `x-idempotent-replay: true`.

### Outbox
- Every create/update/delete inserts an `Outbox` row describing the entity, operation, and payload. Use `packages/infra-prisma/PrismaOutbox` in worker processes to poll and mark messages as processed.

## Example Requests
```bash
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({ service: 'agent-gateway', roles: ['admin'], tenant: 'tenant-01' }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '5m' }))")

curl -X POST http://localhost:8080/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-01" \
  -H "Idempotency-Key: create-user-001" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "displayName": "Agent User",
    "tenantId": "tenant-01"
  }'

curl -X GET http://localhost:8080/v1/users?where={"userId":"user-001"} \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-01"
```

## Testing
```bash
npm test
```
The Vitest suite boots the Fastify app with in-memory adapters and exercises `/v1/users`, `/v1/messages`, and `/v1/conversations` endpoints.

## Tooling
- `npm run lint` – ESLint across apps/packages/tooling.
- `npm run build` – type-check & emit compiled JS into `dist/`.
- `npm run start` – run the compiled app (`dist/apps/gateway/src/main.js`).

## Notes
- For production, use `npm run migrate:deploy` during rollout.
- Vector search is stubbed in the repository; pgvector integration can extend `PrismaRepository.searchEmbedding` once the extension is available.
- Composite IDs use colon-separated segments in path params (e.g., `/v1/agent-shared-states/agent-name:user-1:conv-1`). Document this convention for clients.
