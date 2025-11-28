import { PrismaClient } from '@prisma/client';
import { ITacSdkBridgeService } from '../../domain/interfaces/ITacBridgeService';
import { logger } from '../utils/logger';

export class TacStatusMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaClient,
    private tacSdk: ITacSdkBridgeService,
    private intervalMs = Number(process.env.TON_SWAP_STATUS_INTERVAL_MS || 15000)
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(err => logger.error('Status monitor tick error', { err: err.message })), this.intervalMs);
    logger.info('TacStatusMonitor started', { intervalMs: this.intervalMs });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    const pending = await this.prisma.tonSwapOperation.findMany({
      where: { status: { in: ['pending', 'bridging', 'swapping'] } },
      take: 20
    });

    for (const op of pending) {
      try {
        const status = await this.tacSdk.getTacTransactionStatus(op.operationId);
        const updates: any = {};

        if (status?.status) {
          const normalized = status.status.toLowerCase();
          if (['completed', 'success', 'done'].includes(normalized)) updates.status = 'success';
          else if (['failed', 'error'].includes(normalized)) updates.status = 'failed';
          else if (normalized.includes('bridge')) updates.status = 'bridging';
          else if (normalized.includes('swap')) updates.status = 'swapping';
          else updates.status = status.status;
        }

        if (status?.steps?.length) {
          const tonStep = status.steps.find(s => s.stepId?.toLowerCase().includes('ton'));
          const evmStep = status.steps.find(s => s.stepId?.toLowerCase().includes('evm'));
          if (tonStep?.txHash) updates.txHashTon = tonStep.txHash;
          if (evmStep?.txHash) updates.txHashTac = evmStep.txHash;
        }

        if (status?.failureReason) {
          updates.error = status.failureReason;
          updates.status = 'failed';
        }

        if (Object.keys(updates).length > 0) {
          await this.prisma.tonSwapOperation.update({ where: { operationId: op.operationId }, data: updates });
        }
      } catch (err: any) {
        logger.warn('Status polling failed for op', { op: op.operationId, err: err.message });
      }
    }
  }
}
