import axios, { AxiosInstance } from 'axios';

type PlainObject = Record<string, unknown>;

const CHAIN_ID = parseInt(process.env.ETHEREUM_CHAIN_ID || '1', 10);

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export class DatabaseGatewayClient {
  private readonly enabled: boolean;
  private readonly tenantId: string;
  private readonly client: AxiosInstance | null;

  constructor() {
    const baseURL = (process.env.DB_GATEWAY_URL || '').replace(/\/+$/, '');
    const serviceToken = process.env.DB_GATEWAY_SERVICE_TOKEN || '';
    this.tenantId = process.env.DB_GATEWAY_TENANT_ID || 'panorama-default';
    const timeoutMs = Number(process.env.DB_GATEWAY_TIMEOUT_MS || 1500);
    this.enabled =
      process.env.DB_GATEWAY_SYNC_ENABLED === 'true' &&
      baseURL.length > 0 &&
      serviceToken.length > 0;

    this.client = this.enabled
      ? axios.create({
          baseURL,
          timeout: timeoutMs,
          headers: {
            Authorization: `Bearer ${serviceToken}`,
            'x-tenant-id': this.tenantId,
            'Content-Type': 'application/json',
          },
        })
      : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async patchEntity(entity: string, id: string, data: PlainObject, idempotencyKey: string): Promise<void> {
    if (!this.client) return;
    await this.client.patch(`/v1/${entity}/${encodeURIComponent(id)}`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  private async createEntity(entity: string, data: PlainObject, idempotencyKey: string): Promise<void> {
    if (!this.client) return;
    await this.client.post(`/v1/${entity}`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  private async upsertEntity(
    entity: string,
    id: string,
    createData: PlainObject,
    updateData: PlainObject,
    keyPrefix: string
  ): Promise<void> {
    if (!this.client) return;
    const idempotencyKey = `${keyPrefix}:${id}`;
    try {
      await this.patchEntity(entity, id, updateData, idempotencyKey);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        await this.createEntity(entity, createData, idempotencyKey);
        return;
      }
      throw error;
    }
  }

  async ensureUser(userAddress: string): Promise<void> {
    if (!this.enabled) return;
    const userId = normalizeAddress(userAddress);
    const nowIso = new Date().toISOString();
    await this.upsertEntity(
      'users',
      userId,
      {
        userId,
        walletAddress: userId,
        displayName: 'EVM User',
        tenantId: this.tenantId,
      },
      {
        walletAddress: userId,
        lastSeenAt: nowIso,
      },
      'lido:user'
    );
  }

  async upsertLidoPosition(input: {
    userAddress: string;
    stethWei: string;
    wstethWei: string;
    apyBps?: number | null;
  }): Promise<void> {
    if (!this.enabled) return;
    const userId = normalizeAddress(input.userAddress);
    await this.ensureUser(userId);
    const positionId = `${userId}:${CHAIN_ID}:lido`;
    await this.upsertEntity(
      'lido-positions',
      positionId,
      {
        positionId,
        userId,
        chainId: CHAIN_ID,
        stethWei: input.stethWei,
        wstethWei: input.wstethWei,
        apyBps: input.apyBps ?? undefined,
        tenantId: this.tenantId,
      },
      {
        stethWei: input.stethWei,
        wstethWei: input.wstethWei,
        apyBps: input.apyBps ?? undefined,
      },
      'lido:pos'
    );
  }

  async upsertLidoTx(input: {
    userAddress: string;
    action: 'stake' | 'unstake' | 'claim';
    txHash?: string | null;
    amountWei?: string | null;
    status: string;
    errorMessage?: string | null;
    metadata?: PlainObject;
  }): Promise<void> {
    if (!this.enabled) return;
    const userId = normalizeAddress(input.userAddress);
    await this.ensureUser(userId);
    const txId = input.txHash ? `${CHAIN_ID}:${normalizeAddress(input.txHash)}` : `${CHAIN_ID}:${Date.now()}:${input.action}`;
    await this.upsertEntity(
      'lido-txs',
      txId,
      {
        txId,
        userId,
        chainId: CHAIN_ID,
        action: input.action,
        amountWei: input.amountWei ?? undefined,
        txHash: input.txHash ?? undefined,
        status: input.status,
        errorMessage: input.errorMessage ?? undefined,
        metadata: input.metadata,
        tenantId: this.tenantId,
      },
      {
        amountWei: input.amountWei ?? undefined,
        txHash: input.txHash ?? undefined,
        status: input.status,
        errorMessage: input.errorMessage ?? undefined,
        metadata: input.metadata,
      },
      'lido:tx'
    );
  }
}

export const databaseGatewayClient = new DatabaseGatewayClient();
