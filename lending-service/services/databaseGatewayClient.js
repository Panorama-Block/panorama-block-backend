const axios = require('axios');
const { NETWORKS } = require('../config/constants');

const DEFAULT_CHAIN_ID = NETWORKS.AVALANCHE.chainId;

function toLowerAddress(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function marketIdFrom(chainId, qTokenAddress) {
  return `${chainId}:${toLowerAddress(qTokenAddress)}`;
}

function positionIdFrom(userId, marketId) {
  return `${userId}:${marketId}`;
}

function snapshotIdFrom(userId, chainId, dateIso) {
  return `${userId}:${chainId}:${dateIso}`;
}

class DatabaseGatewayClient {
  constructor() {
    this.enabled =
      process.env.DB_GATEWAY_SYNC_ENABLED === 'true' &&
      !!process.env.DB_GATEWAY_URL &&
      !!process.env.DB_GATEWAY_SERVICE_TOKEN;
    this.baseUrl = (process.env.DB_GATEWAY_URL || '').replace(/\/+$/, '');
    this.serviceToken = process.env.DB_GATEWAY_SERVICE_TOKEN || '';
    this.tenantId = process.env.DB_GATEWAY_TENANT_ID || 'panorama-default';
    this.timeoutMs = Number(process.env.DB_GATEWAY_TIMEOUT_MS || 1500);
    this.failureCooldownMs = Number(process.env.DB_GATEWAY_FAILURE_COOLDOWN_MS || 30_000);
    this.blockedUntil = 0;
  }

  isEnabled() {
    return this.enabled && Date.now() >= this.blockedUntil;
  }

  handleNetworkFailure(error) {
    const code = error?.code || error?.cause?.code;
    const status = error?.response?.status;
    const isTransient =
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN' ||
      (typeof status === 'number' && status >= 500);

    if (!isTransient) return;
    this.blockedUntil = Date.now() + this.failureCooldownMs;
    console.warn(`[BENQI][DB-GATEWAY] Temporarily disabled for ${Math.round(this.failureCooldownMs / 1000)}s after network error:`, error?.message || error);
  }

  headers(idempotencyKey) {
    const headers = {
      Authorization: `Bearer ${this.serviceToken}`,
      'x-tenant-id': this.tenantId,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  async patchEntity(entity, id, data, idempotencyKey) {
    const url = `${this.baseUrl}/v1/${entity}/${encodeURIComponent(id)}`;
    try {
      return await axios.patch(url, data, {
        headers: this.headers(idempotencyKey),
        timeout: this.timeoutMs,
      });
    } catch (error) {
      this.handleNetworkFailure(error);
      throw error;
    }
  }

  async createEntity(entity, data, idempotencyKey) {
    const url = `${this.baseUrl}/v1/${entity}`;
    try {
      return await axios.post(url, data, {
        headers: this.headers(idempotencyKey),
        timeout: this.timeoutMs,
      });
    } catch (error) {
      this.handleNetworkFailure(error);
      throw error;
    }
  }

  async getEntity(entity, id) {
    const url = `${this.baseUrl}/v1/${entity}/${encodeURIComponent(id)}`;
    try {
      const resp = await axios.get(url, {
        headers: this.headers(),
        timeout: this.timeoutMs,
      });
      return resp.data;
    } catch (error) {
      this.handleNetworkFailure(error);
      throw error;
    }
  }

  async listEntities(entity, query) {
    const url = `${this.baseUrl}/v1/${entity}`;
    try {
      const resp = await axios.get(url, {
        headers: this.headers(),
        timeout: this.timeoutMs * 2,
        params: query,
      });
      return resp.data;
    } catch (error) {
      this.handleNetworkFailure(error);
      throw error;
    }
  }

  async upsertEntity(entity, id, createData, updateData, keyPrefix) {
    if (!this.isEnabled()) return;
    const idempotencyKey = `${keyPrefix}:${id}`;
    try {
      await this.patchEntity(entity, id, updateData, idempotencyKey);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) {
        await this.createEntity(entity, createData, idempotencyKey);
        return;
      }
      throw error;
    }
  }

  async ensureUser(address) {
    if (!this.isEnabled() || !address) return;
    const userId = toLowerAddress(address);
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
      'lend:user'
    );
  }

  async syncMarkets(markets) {
    if (!this.isEnabled() || !Array.isArray(markets) || markets.length === 0) return;
    for (const market of markets) {
      const chainId = Number(market?.chainId || DEFAULT_CHAIN_ID);
      const qTokenAddress = toLowerAddress(market?.qTokenAddress);
      if (!qTokenAddress) continue;
      const marketId = marketIdFrom(chainId, qTokenAddress);
      const underlyingAddress = market?.underlyingAddress || 'native';
      const payload = {
        marketId,
        chainId,
        protocol: market?.protocol || 'benqi',
        qTokenAddress,
        qTokenSymbol: market?.qTokenSymbol || 'qToken',
        underlyingAddress,
        underlyingSymbol: market?.underlyingSymbol || 'UNKNOWN',
        underlyingDecimals: Number(market?.underlyingDecimals ?? 18),
        collateralFactorBps:
          Number.isFinite(Number(market?.collateralFactorBps)) ? Number(market.collateralFactorBps) : undefined,
        supplyApyBps:
          Number.isFinite(Number(market?.supplyApyBps)) ? Number(market.supplyApyBps) : undefined,
        borrowApyBps:
          Number.isFinite(Number(market?.borrowApyBps)) ? Number(market.borrowApyBps) : undefined,
        isActive: true,
        metadata: {
          source: 'benqi-markets',
          syncedAt: Date.now(),
        },
        tenantId: this.tenantId,
      };

      await this.upsertEntity(
        'lending-markets',
        marketId,
        payload,
        {
          protocol: payload.protocol,
          qTokenSymbol: payload.qTokenSymbol,
          underlyingSymbol: payload.underlyingSymbol,
          underlyingDecimals: payload.underlyingDecimals,
          collateralFactorBps: payload.collateralFactorBps,
          supplyApyBps: payload.supplyApyBps,
          borrowApyBps: payload.borrowApyBps,
          isActive: payload.isActive,
          metadata: payload.metadata,
        },
        'lend:market'
      );
    }
  }

  async syncAccountPositions(address, accountData) {
    if (!this.isEnabled() || !address) return;
    const userId = toLowerAddress(address);
    const chainId = DEFAULT_CHAIN_ID;
    const positions = Array.isArray(accountData?.positions) ? accountData.positions : [];
    const updatedAt = Number(accountData?.updatedAt || Date.now());
    const liquidity = accountData?.liquidity || {};

    await this.ensureUser(userId);
    await this.syncMarkets(
      positions.map((p) => ({
        chainId,
        protocol: 'benqi',
        qTokenAddress: p.qTokenAddress,
        qTokenSymbol: p.qTokenSymbol,
        underlyingAddress: p.underlyingAddress || 'native',
        underlyingSymbol: p.underlyingSymbol,
        underlyingDecimals: p.underlyingDecimals,
      }))
    );

    let totalSuppliedWei = 0n;
    let totalBorrowedWei = 0n;

    for (const position of positions) {
      const qTokenAddress = toLowerAddress(position?.qTokenAddress);
      if (!qTokenAddress) continue;
      const marketId = marketIdFrom(chainId, qTokenAddress);
      const positionId = positionIdFrom(userId, marketId);
      const suppliedWei = String(position?.suppliedWei || '0');
      const borrowedWei = String(position?.borrowedWei || '0');
      totalSuppliedWei += BigInt(suppliedWei);
      totalBorrowedWei += BigInt(borrowedWei);

      const payload = {
        positionId,
        userId,
        marketId,
        suppliedWei,
        borrowedWei,
        collateralEnabled: !!position?.collateralEnabled,
        tenantId: this.tenantId,
      };

      await this.upsertEntity(
        'lending-positions',
        positionId,
        payload,
        {
          suppliedWei,
          borrowedWei,
          collateralEnabled: !!position?.collateralEnabled,
        },
        'lend:pos'
      );
    }

    const snapshotDate = new Date(updatedAt).toISOString().slice(0, 10);
    const snapshotId = snapshotIdFrom(userId, chainId, snapshotDate);
    const snapshotPayload = {
      snapshotId,
      userId,
      chainId,
      date: new Date(`${snapshotDate}T00:00:00.000Z`).toISOString(),
      totalSuppliedWei: totalSuppliedWei.toString(),
      totalBorrowedWei: totalBorrowedWei.toString(),
      liquidityWei: String(liquidity?.liquidity || '0'),
      shortfallWei: String(liquidity?.shortfall || '0'),
      healthFactor: liquidity?.healthFactor ? String(liquidity.healthFactor) : undefined,
      metadata: {
        source: 'benqi-account-positions',
        syncedAt: updatedAt,
      },
      tenantId: this.tenantId,
    };

    await this.upsertEntity(
      'lending-snapshots',
      snapshotId,
      snapshotPayload,
      {
        totalSuppliedWei: snapshotPayload.totalSuppliedWei,
        totalBorrowedWei: snapshotPayload.totalBorrowedWei,
        liquidityWei: snapshotPayload.liquidityWei,
        shortfallWei: snapshotPayload.shortfallWei,
        healthFactor: snapshotPayload.healthFactor,
        metadata: snapshotPayload.metadata,
      },
      'lend:snap'
    );
  }
  /**
   * Record a lending transaction (supply, redeem, borrow, repay, etc.)
   * Called after the frontend submits a tx hash.
   */
  async recordTransaction({ userId, chainId, action, amountWei, txHash, status, metadata }) {
    if (!this.isEnabled() || !userId) return;
    const normalizedUser = toLowerAddress(userId);
    const txId = `${normalizedUser}:${chainId || 43114}:${txHash || Date.now()}`;
    const payload = {
      txId,
      userId: normalizedUser,
      chainId: chainId || 43114,
      action,
      amountWei: amountWei || null,
      txHash: txHash || null,
      status: status || 'pending',
      errorMessage: null,
      metadata: metadata || null,
      tenantId: this.tenantId,
    };

    await this.upsertEntity(
      'lending-txs',
      txId,
      payload,
      { status: payload.status, txHash: payload.txHash, metadata: payload.metadata },
      'lend:tx'
    );
  }

  /**
   * Update transaction status (e.g. pending → confirmed / failed).
   */
  async updateTransactionStatus(txId, status, errorMessage) {
    if (!this.isEnabled() || !txId) return;
    const data = { status };
    if (errorMessage) data.errorMessage = errorMessage;
    try {
      await this.patchEntity('lending-txs', txId, data, `lend:tx:${txId}`);
    } catch {
      // best-effort — don't fail the request
    }
  }
}

module.exports = new DatabaseGatewayClient();
