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
    req.verifiedAddress = '0x1111111111111111111111111111111111111111';
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

describe('benqiRoutes /markets', () => {
  const describeRoutes =
    process.env.CI === 'true' || process.env.ALLOW_SOCKET_TESTS === 'true'
      ? describe
      : describe.skip;

  const qTokenA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const qTokenB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const comptrollerAddress = '0xcccccccccccccccccccccccccccccccccccccccc';
  const usdcAddress = '0xdddddddddddddddddddddddddddddddddddddddd';

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
        markets: jest.fn().mockResolvedValue([true, '600000000000000000', true]),
      }),
      getUnderlyingAddress: jest
        .fn()
        .mockImplementation(async (address) => (address.toLowerCase() === qTokenA ? null : usdcAddress)),
      getInterestRates: jest
        .fn()
        .mockImplementation(async (address) => {
          if (address.toLowerCase() === qTokenB) {
            throw new Error('rpc timeout');
          }
          return { supplyApyBps: 420, borrowApyBps: 810 };
        }),
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
      if (addr === usdcAddress) {
        return {
          decimals: jest.fn().mockResolvedValue(6),
          symbol: jest.fn().mockResolvedValue('USDC'),
        };
      }
      throw new Error(`Unexpected contract: ${address}`);
    });

    app = buildApp();
  });

  describeRoutes('socket-dependent checks', () => {
    test('deduplicates in-flight requests, caches payload and degrades partial market rows', async () => {
      const [first, second] = await Promise.all([
        request(app).get('/markets'),
        request(app).get('/markets'),
      ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(benqiServiceMock.getAllMarkets).toHaveBeenCalledTimes(1);

    const firstPayload = first.body?.data?.markets;
    expect(Array.isArray(firstPayload)).toBe(true);
    expect(firstPayload).toHaveLength(2);

    const avaxRow = firstPayload.find((row) => row.qTokenAddress.toLowerCase() === qTokenA);
    const usdcRow = firstPayload.find((row) => row.qTokenAddress.toLowerCase() === qTokenB);

    expect(avaxRow).toMatchObject({
      protocol: 'benqi',
      underlyingSymbol: 'AVAX',
      supplyApyBps: 420,
      borrowApyBps: 810,
    });

    expect(usdcRow).toMatchObject({
      protocol: 'benqi',
      underlyingAddress: usdcAddress,
      underlyingSymbol: 'USDC',
      supplyApyBps: null,
      borrowApyBps: null,
    });

      const third = await request(app).get('/markets');
      expect(third.status).toBe(200);
      expect(benqiServiceMock.getAllMarkets).toHaveBeenCalledTimes(1);
    });
  });
});
