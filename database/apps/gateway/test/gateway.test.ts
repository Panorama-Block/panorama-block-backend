import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { buildApp } from '../src/http/app.js';
import { AppConfig } from '../src/config.js';
import { signTestToken } from './setup.js';
import {
  RepositoryPort,
  RequestCtx,
  Query,
  TransactionOp
} from '../../../packages/core/ports/index.js';
import { entityConfigByCollection } from '../../../packages/core/entities.js';
import { IdempotencyStore } from '../../../packages/infra-prisma/index.js';
import { PrismaClient } from '@prisma/client';

class InMemoryIdempotencyStore extends IdempotencyStore {
  private readonly store = new Map<string, { requestHash: string; response: unknown }>();

  constructor() {
    super({} as PrismaClient);
  }

  async find(key: string) {
    const value = this.store.get(key);
    return value ? { response: value.response } : null;
  }

  async save(key: string, requestHash: string, response: unknown) {
    this.store.set(key, { requestHash, response });
  }

  async getRequestHash(key: string): Promise<string | null> {
    const value = this.store.get(key);
    return value?.requestHash ?? null;
  }
}

class InMemoryRepository implements RepositoryPort {
  private data: Record<string, any[]> = {};

  constructor(seed: Record<string, any[]>) {
    this.data = JSON.parse(JSON.stringify(seed));
  }

  private config(entity: string) {
    const config = entityConfigByCollection[entity];
    if (!config) throw new Error(`Unknown entity ${entity}`);
    return config;
  }

  private tenantMatches(entity: string, record: any, ctx: RequestCtx) {
    const config = this.config(entity);
    if (!config.tenantField) return true;
    return record[config.tenantField] === ctx.tenantId;
  }

  private recordList(entity: string): any[] {
    if (!this.data[entity]) this.data[entity] = [];
    return this.data[entity];
  }

  async list(entity: string, q: Query, ctx: RequestCtx) {
    const config = this.config(entity);
    const items = this.recordList(entity).filter((item) => this.tenantMatches(entity, item, ctx));

    if (q.where) {
      return {
        data: items.filter((item) =>
          Object.entries(q.where!).every(([key, value]) => item[key] === value)
        )
      };
    }

    return { data: items };
  }

  async get(entity: string, id: any, ctx: RequestCtx) {
    const config = this.config(entity);
    const items = this.recordList(entity);
    const found = items.find((item) => this.matchesId(config, item, id));
    if (!found || !this.tenantMatches(entity, found, ctx)) return null;
    return found;
  }

  async create(entity: string, data: Record<string, unknown>, ctx: RequestCtx) {
    const config = this.config(entity);
    const record = { ...data } as any;
    if (config.tenantField) record[config.tenantField] = ctx.tenantId;
    this.recordList(entity).push(record);
    return record;
  }

  async update(entity: string, id: any, data: Record<string, unknown>, ctx: RequestCtx) {
    const config = this.config(entity);
    const list = this.recordList(entity);
    const index = list.findIndex((item) => this.matchesId(config, item, id));
    if (index === -1) {
      const error = new Error('NotFoundError');
      error.name = 'NotFoundError';
      throw error;
    }
    if (!this.tenantMatches(entity, list[index], ctx)) {
      const error = new Error('ForbiddenError');
      error.name = 'ForbiddenError';
      throw error;
    }
    list[index] = { ...list[index], ...data };
    return list[index];
  }

  async delete(entity: string, id: any, ctx: RequestCtx) {
    const config = this.config(entity);
    const list = this.recordList(entity);
    const idx = list.findIndex((item) => this.matchesId(config, item, id));
    if (idx === -1) {
      const error = new Error('NotFoundError');
      error.name = 'NotFoundError';
      throw error;
    }
    if (!this.tenantMatches(entity, list[idx], ctx)) {
      const error = new Error('ForbiddenError');
      error.name = 'ForbiddenError';
      throw error;
    }
    list.splice(idx, 1);
  }

  async transact(ops: TransactionOp[], ctx: RequestCtx) {
    const results: any[] = [];
    for (const op of ops) {
      if (op.op === 'create') {
        results.push(await this.create(op.entity, op.args.data, ctx));
      }
      if (op.op === 'update') {
        results.push(await this.update(op.entity, op.args.id, op.args.data, ctx));
      }
      if (op.op === 'delete') {
        await this.delete(op.entity, op.args.id, ctx);
        results.push({ status: 'deleted' });
      }
    }
    return results;
  }

  matchesId(config: ReturnType<InMemoryRepository['config']>, item: any, id: any) {
    if (config.primaryKeys.length === 1) {
      const key = config.primaryKeys[0];
      return item[key] === id;
    }
    const parts = typeof id === 'string' ? id.split(':') : config.primaryKeys.map((key) => id[key]);
    return config.primaryKeys.every((key, index) => item[key] === parts[index]);
  }
}

const seedData = {
  users: [
    {
      userId: 'user-1',
      tenantId: 'tenant-test',
      displayName: 'First User',
      attributes: {}
    }
  ],
  conversations: [
    {
      id: 'conv-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      tenantId: 'tenant-test'
    }
  ],
  messages: [
    {
      messageId: 'msg-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      tenantId: 'tenant-test'
    }
  ]
};

describe('Gateway HTTP API', () => {
  const config: AppConfig = {
    port: 8080,
    host: '127.0.0.1',
    logLevel: 'silent',
    jwtSecret: process.env.JWT_SECRET!
  };

  const repository = new InMemoryRepository(seedData);
  const idempotencyStore = new InMemoryIdempotencyStore();
  const prismaStub = { $disconnect: async () => {} } as unknown as PrismaClient;

  const app = buildApp({ config, prisma: prismaStub, repository, idempotencyStore });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = () => `Bearer ${signTestToken()}`;

  it('lists users for the tenant', async () => {
    const response = await request(app.server)
      .get('/v1/users')
      .set('authorization', authHeader())
      .set('x-tenant-id', 'tenant-test');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe('user-1');
  });

  it('creates a message with idempotency', async () => {
    const payload = {
      userId: 'user-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Reply message',
      tenantId: 'ignored'
    };

    const response = await request(app.server)
      .post('/v1/messages')
      .set('authorization', authHeader())
      .set('x-tenant-id', 'tenant-test')
      .set('idempotency-key', 'test-key-1')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.content).toBe('Reply message');

    const replay = await request(app.server)
      .post('/v1/messages')
      .set('authorization', authHeader())
      .set('x-tenant-id', 'tenant-test')
      .set('idempotency-key', 'test-key-1')
      .send(payload);

    expect(replay.status).toBe(200);
    expect(replay.headers['x-idempotent-replay']).toBe('true');
  });

  it('updates a conversation', async () => {
    const response = await request(app.server)
      .patch('/v1/conversations/conv-1')
      .set('authorization', authHeader())
      .set('x-tenant-id', 'tenant-test')
      .set('idempotency-key', 'test-key-2')
      .send({ title: 'Updated title' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated title');
  });
});
