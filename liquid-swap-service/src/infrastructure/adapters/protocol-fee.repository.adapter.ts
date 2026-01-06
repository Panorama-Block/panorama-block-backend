// Infrastructure Adapter - Protocol Fee Repository (Prisma)
import { PrismaClient } from "@prisma/client";
import { IProtocolFeeRepository } from "../../domain/ports/protocol-fee.repository";
import { ProtocolFeeConfig } from "../../domain/entities/protocol-fee";

// Type for Prisma ProtocolFeeConfig record - using generic types for Decimal
type PrismaProtocolFeeRecord = {
  id: string;
  provider: string;
  taxInPercent: { toString(): string }; // Prisma Decimal
  taxInBips: number | null;
  taxInEth: { toString(): string } | null; // Prisma Decimal
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class ProtocolFeeRepositoryAdapter implements IProtocolFeeRepository {
  private readonly prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma =
      prismaClient ??
      new PrismaClient({
        log:
          process.env.DEBUG === "true"
            ? ["query", "info", "warn", "error"]
            : ["error"],
      });

    console.log("[ProtocolFeeRepositoryAdapter] Initialized");
  }

  async getByProvider(provider: string): Promise<ProtocolFeeConfig | null> {
    try {
      const record = await this.prisma.protocolFeeConfig.findUnique({
        where: { provider },
      });

      if (!record) return null;

      return new ProtocolFeeConfig(
        record.id,
        record.provider,
        Number(record.taxInPercent),
        record.isActive,
        record.taxInBips,
        record.taxInEth ? BigInt(record.taxInEth.toString()) : null,
        record.createdAt,
        record.updatedAt
      );
    } catch (error) {
      console.error(
        "[ProtocolFeeRepositoryAdapter] Error getting by provider:",
        error
      );
      throw error;
    }
  }

  async getAllActive(): Promise<ProtocolFeeConfig[]> {
    try {
      const records = await this.prisma.protocolFeeConfig.findMany({
        where: { isActive: true },
      });

      return records.map(
        (record: PrismaProtocolFeeRecord) =>
          new ProtocolFeeConfig(
            record.id,
            record.provider,
            Number(record.taxInPercent),
            record.isActive,
            record.taxInBips,
            record.taxInEth ? BigInt(record.taxInEth.toString()) : null,
            record.createdAt,
            record.updatedAt
          )
      );
    } catch (error) {
      console.error(
        "[ProtocolFeeRepositoryAdapter] Error getting all active:",
        error
      );
      throw error;
    }
  }

  async save(config: ProtocolFeeConfig): Promise<void> {
    try {
      await this.prisma.protocolFeeConfig.update({
        where: { provider: config.provider },
        data: {
          taxInPercent: config.taxInPercent,
          taxInBips: config.taxInBips,
          taxInEth: config.taxInEth?.toString(),
          isActive: config.isActive,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[ProtocolFeeRepositoryAdapter] Updated fee for ${config.provider}: ${config.taxInPercent}%`
      );
    } catch (error) {
      console.error("[ProtocolFeeRepositoryAdapter] Error saving:", error);
      throw error;
    }
  }

  async create(config: ProtocolFeeConfig): Promise<void> {
    try {
      await this.prisma.protocolFeeConfig.create({
        data: {
          id: config.id,
          provider: config.provider,
          taxInPercent: config.taxInPercent,
          taxInBips: config.taxInBips,
          taxInEth: config.taxInEth?.toString(),
          isActive: config.isActive,
        },
      });

      console.log(
        `[ProtocolFeeRepositoryAdapter] Created fee for ${config.provider}: ${config.taxInPercent}%`
      );
    } catch (error) {
      console.error("[ProtocolFeeRepositoryAdapter] Error creating:", error);
      throw error;
    }
  }

  async exists(provider: string): Promise<boolean> {
    try {
      const count = await this.prisma.protocolFeeConfig.count({
        where: { provider },
      });
      return count > 0;
    } catch (error) {
      console.error(
        "[ProtocolFeeRepositoryAdapter] Error checking exists:",
        error
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    console.log("[ProtocolFeeRepositoryAdapter] Disconnected");
  }
}
