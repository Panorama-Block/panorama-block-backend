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

## Database Configuration
### Local development
- Keep using `docker compose up postgres -d` together with the `.env` entry `DATABASE_URL="postgresql://postgres:postgres@postgres:5432/panorama_db?schema=public"`.
- `npm run migrate:dev` or the `docker-compose` service will apply migrations against the local container.

### Azure Database for PostgreSQL Flexible Server
1. Create (or reuse) a dedicated database on your server so production data lives outside the default `postgres` DB:
   ```bash
   az postgres flexible-server db create \
     --resource-group Core-Deploy \
     --server-name panorama-db \
     --database-name panorama_data_gateway
   ```
2. Build the production connection string (be sure to keep `sslmode=require`):
   ```
   postgresql://panoramadmin:<PASSWORD>@panorama-db.postgres.database.azure.com:5432/panorama_data_gateway?sslmode=require
   ```
3. Store that string as the GitHub secret `DATABASE_URL` (referenced by the deployment workflow) and as the `database-url` secret on the Azure Container App.
4. To run migrations against Azure from your terminal, export that URL temporarily:
   ```bash
   export DATABASE_URL="postgresql://panoramadmin:********@panorama-db.postgres.database.azure.com:5432/panorama_data_gateway?sslmode=require"
   npm run migrate:deploy
   ```
   Remember to unset or replace it with the local URL afterwards so local development keeps using Docker Postgres.

## CI/CD
- The workflow `.github/workflows/deploy-database-gateway.yml` builds `./database`, runs `prisma migrate deploy` against the Azure Flexible Server using the `DATABASE_URL` GitHub secret, pushes the image to GHCR, and updates the `gateway-database` Azure Container App.
- Provide the workflow with `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `GHCR_USERNAME`, `GHCR_PASSWORD`, and `DATABASE_URL` secrets. The reusable GHCR credentials can be the same ones already used by the other services.

## Azure Container App bootstrap
1. Ensure you know your Container Apps environment ID (`ACA_ENV_ID`) and have the GHCR namespace (`GHCR_NAMESPACE`) available.
2. Set the initial secrets so the container can reach Azure Postgres and verify JWTs:
   ```bash
   az containerapp secret set \
     --name gateway-database \
     --resource-group Core-Deploy \
     --secrets \
       database-url="postgresql://panoramadmin:********@panorama-db.postgres.database.azure.com:5432/panorama_data_gateway?sslmode=require" \
       jwt-secret="<PRODUCTION_JWT_SECRET>" \
       ghcr-password="<GHCR_PAT>"
   ```
3. (First-time only) create the container app with a placeholder image so the workflow can take over subsequent releases:
   ```bash
   export ACA_ENV_ID="/subscriptions/<sub>/resourceGroups/Core-Deploy/providers/Microsoft.App/managedEnvironments/<env>"
   export GHCR_NAMESPACE="<github-owner>"
   az containerapp create \
     --resource-group Core-Deploy \
     --name gateway-database \
     --yaml infra/container-apps/database-gateway.yaml \
     --image mcr.microsoft.com/azure-containerapps/hello-world:latest
   ```
   The deployment workflow will replace the image with the GHCR build on the next run.
4. Any time you need to rotate secrets, call `az containerapp secret set` again (the workflow only updates the image).

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
