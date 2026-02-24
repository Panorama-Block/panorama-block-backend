const express = require('express');
const request = require('supertest');

const mockJsonRpcProvider = jest.fn();
const mockContractFactory = jest.fn();
const mockIsAddress = jest.fn((value) => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value));
const mockFormatUnits = jest.fn((value, decimals = 18) => {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return '0';
  return String(asNumber / 10 ** Number(decimals));
});

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn((...args) => mockJsonRpcProvider(...args)),
    Contract: jest.fn((...args) => mockContractFactory(...args)),
    isAddress: jest.fn((...args) => mockIsAddress(...args)),
    formatUnits: jest.fn((...args) => mockFormatUnits(...args)),
  },
}));

jest.mock('../../../middleware/auth', () => ({
  verifySignature: (req, _res, next) => {
    req.verifiedAddress = req.headers['x-auth-address'] || '0x1111111111111111111111111111111111111111';
    next();
  },
  createRateLimiter: () => (_req, _res, next) => next(),
  validateNetwork: () => (_req, _res, next) => next(),
  sanitizeInput: (_req, _res, next) => next(),
}));

jest.mock('../../../services/databaseGatewayClient', () => ({
  isEnabled: jest.fn(() => false),
  syncMarkets: jest.fn(),
  syncAccountPositions: jest.fn(),
}));

jest.mock('../../../services/benqiService', () => jest.fn());

describe('benqiRoutes /account/:address/positions', () => {
  const describeRoutes =
    process.env.CI === 'true' || process.env.ALLOW_SOCKET_TESTS === 'true'
      ? describe
      : describe.skip;

  const userAddress = '0x1111111111111111111111111111111111111111';
  const otherAddress = '0x2222222222222222222222222222222222222222';
  const qTokenA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const qTokenB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const comptrollerAddress = '0xcccccccccccccccccccccccccccccccccccccccc';

  let BenqiService;
  let benqiServiceMock;
  let app;

  function buildApp() {
    const router = require('../../../routes/benqiRoutes');
    const instance = express();
    instance.use(express.json());
    instance.use('/', router);
    return instance;
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    BenqiService = require('../../../services/benqiService');
    benqiServiceMock = {
      getAllMarkets: jest.fn().mockResolvedValue([qTokenA, qTokenB]),
      getComptroller: jest.fn().mockResolvedValue({
        markets: jest.fn().mockResolvedValue([true, '500000000000000000', true]),
      }),
      getUnderlyingAddress: jest.fn().mockResolvedValue('native'),
      getAccountLiquidity: jest.fn(),
      getAssetsIn: jest.fn(),
      getQTokenBalance: jest.fn(),
      getBorrowBalance: jest.fn(),
      getInterestRates: jest.fn().mockResolvedValue({ supplyApyBps: 100, borrowApyBps: 200 }),
    };
    BenqiService.mockImplementation(() => benqiServiceMock);

    mockJsonRpcProvider.mockImplementation(() => ({ kind: 'provider' }));
    mockContractFactory.mockImplementation((address) => {
      const addr = String(address).toLowerCase();
      if (addr === qTokenA || addr === qTokenB) {
        return {
          symbol: jest.fn().mockResolvedValue(addr === qTokenA ? 'qiAVAX' : 'qiUSDC'),
          comptroller: jest.fn().mockResolvedValue(comptrollerAddress),
          decimals: jest.fn().mockResolvedValue(8),
        };
      }
      return {
        decimals: jest.fn().mockResolvedValue(18),
        symbol: jest.fn().mockResolvedValue('AVAX'),
      };
    });

    app = buildApp();
  });

  describeRoutes('socket-dependent checks', () => {
    test('returns 403 when requested account mismatches authenticated address', async () => {
      const response = await request(app)
        .get(`/account/${otherAddress}/positions`)
        .set('x-auth-address', userAddress);

      expect(response.status).toBe(403);
      expect(response.body?.data?.error).toBe('Forbidden');
    });

    test('returns degraded/partial payload with warnings on rate-limit and timeout failures', async () => {
      benqiServiceMock.getAccountLiquidity.mockRejectedValue(new Error('Too Many Requests (-32005)'));
      benqiServiceMock.getAssetsIn.mockRejectedValue(new Error('timeout after 2500ms'));
      benqiServiceMock.getQTokenBalance.mockImplementation(async (qTokenAddress) => {
        if (String(qTokenAddress).toLowerCase() === qTokenA) {
          throw new Error('Too Many Requests (-32005)');
        }
        return {
          qTokenAddress,
          accountAddress: userAddress,
          qTokenBalance: '100',
          underlyingBalance: '100000000000000000',
        };
      });
      benqiServiceMock.getBorrowBalance.mockResolvedValue({
        qTokenAddress: qTokenB,
        accountAddress: userAddress,
        borrowBalance: '0',
      });

      const response = await request(app)
        .get(`/account/${userAddress}/positions`)
        .set('x-auth-address', userAddress);

      expect(response.status).toBe(200);
      expect(response.body?.msg).toBe('success');
      expect(Array.isArray(response.body?.data?.warnings)).toBe(true);
      expect(response.body.data.warnings.join(' ')).toMatch(/rate limited|timed out|temporarily unavailable/i);
      expect(Array.isArray(response.body?.data?.positions)).toBe(true);
      expect(response.body.data.positions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
