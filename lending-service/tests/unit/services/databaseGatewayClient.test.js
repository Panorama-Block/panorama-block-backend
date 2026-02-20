jest.mock('axios');

const ORIGINAL_ENV = process.env;

function loadClientWithEnv(overrides = {}) {
  jest.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    DB_GATEWAY_SYNC_ENABLED: 'true',
    DB_GATEWAY_URL: 'http://gateway.local',
    DB_GATEWAY_SERVICE_TOKEN: 'service-token',
    DB_GATEWAY_TENANT_ID: 'tenant-test',
    DB_GATEWAY_FAILURE_COOLDOWN_MS: '50',
    ...overrides,
  };
  const axios = require('axios');
  const client = require('../../../services/databaseGatewayClient');
  return { client, axios };
}

describe('databaseGatewayClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('isEnabled respects transient cooldown after network failure', () => {
    const { client } = loadClientWithEnv();

    expect(client.isEnabled()).toBe(true);

    client.handleNetworkFailure({ code: 'ECONNREFUSED', message: 'connection refused' });
    expect(client.isEnabled()).toBe(false);

    client.blockedUntil = Date.now() - 1;
    expect(client.isEnabled()).toBe(true);
  });

  test('headers include auth, tenant and idempotency key when provided', () => {
    const { client } = loadClientWithEnv();
    const headers = client.headers('idem-123');

    expect(headers).toMatchObject({
      Authorization: 'Bearer service-token',
      'x-tenant-id': 'tenant-test',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-123',
    });
  });

  test('upsertEntity falls back patch -> create on 404', async () => {
    const { client, axios } = loadClientWithEnv();

    axios.patch.mockRejectedValueOnce({
      response: { status: 404 },
      message: 'not found',
    });
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    await client.upsertEntity(
      'lending-markets',
      '43114:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      { marketId: '43114:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', chainId: 43114 },
      { chainId: 43114 },
      'lend:market',
    );

    expect(axios.patch).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('/v1/lending-markets');
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe('Bearer service-token');
  });

  test('patchEntity propagates transient network errors and opens cooldown', async () => {
    const { client, axios } = loadClientWithEnv();

    const err = new Error('connection reset');
    err.code = 'ECONNRESET';
    axios.patch.mockRejectedValueOnce(err);

    await expect(
      client.patchEntity('lending-txs', 'tx-1', { status: 'pending' }, 'idem-tx-1'),
    ).rejects.toThrow('connection reset');

    expect(client.blockedUntil).toBeGreaterThan(Date.now() - 1);
    expect(client.isEnabled()).toBe(false);
  });

  test('upsertEntity is a no-op when sync is disabled', async () => {
    const { client, axios } = loadClientWithEnv({ DB_GATEWAY_SYNC_ENABLED: 'false' });

    await client.upsertEntity(
      'users',
      '0x1111111111111111111111111111111111111111',
      { userId: '0x1111111111111111111111111111111111111111' },
      { lastSeenAt: new Date().toISOString() },
      'lend:user',
    );

    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
