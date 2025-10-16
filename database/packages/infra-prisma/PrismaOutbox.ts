import { PrismaClient } from '@prisma/client';

export interface OutboxMessage {
  id: string;
  entity: string;
  op: string;
  payload: unknown;
  occurredAt: Date;
  processedAt: Date | null;
  attempts: number;
}

export class PrismaOutbox {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchUnprocessed(limit = 100): Promise<OutboxMessage[]> {
    return await this.prisma.outbox.findMany({
      where: { processedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: {
        processedAt: new Date()
      }
    });
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: {
        attempts: { increment: 1 }
      }
    });
  }
}
