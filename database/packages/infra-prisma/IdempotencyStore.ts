import { Prisma, PrismaClient } from '@prisma/client';

export interface StoredResponse {
  response: unknown;
}

export class IdempotencyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async find(key: string): Promise<StoredResponse | null> {
    const record = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (!record) {
      return null;
    }
    return { response: record.response };
  }

  async save(key: string, requestHash: string, response: unknown): Promise<void> {
    await this.prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        requestHash,
        response: response as Prisma.InputJsonValue
      },
      create: {
        key,
        requestHash,
        response: response as Prisma.InputJsonValue
      }
    });
  }

  async getRequestHash(key: string): Promise<string | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: { key },
      select: { requestHash: true }
    });
    return record?.requestHash ?? null;
  }
}
