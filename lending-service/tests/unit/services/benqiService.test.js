const { BENQI } = require('../../../config/constants');

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: jest.fn(),
      JsonRpcProvider: jest.fn(),
      isAddress: jest.fn((value) => typeof value === 'string' && value.startsWith('0x') && value.length === 42),
    },
  };
});

const { ethers } = require('ethers');
const BenqiService = require('../../../services/benqiService');

describe('BenqiService', () => {
  const provider = { id: 'provider' };
  const accountAddress = '0x1111111111111111111111111111111111111111';
  const qTokenAddress = '0x2222222222222222222222222222222222222222';
  const comptrollerAddress = '0x3333333333333333333333333333333333333333';
  const underlyingAddress = '0x4444444444444444444444444444444444444444';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockContracts(contractMap) {
    ethers.Contract.mockImplementation((address) => {
      const contract = contractMap[address];
      if (!contract) {
        throw new Error(`Unexpected contract address: ${address}`);
      }
      return contract;
    });
  }

  test('resolveComptrollerAddress uses a valid configured candidate', async () => {
    const contracts = {
      [comptrollerAddress]: {
        getAllMarkets: jest.fn().mockResolvedValue([qTokenAddress]),
      },
      [qTokenAddress]: {
        symbol: jest.fn().mockResolvedValue('qiAVAX'),
        comptroller: jest.fn().mockResolvedValue(comptrollerAddress),
      },
    };
    mockContracts(contracts);

    const service = new BenqiService(provider);
    service.comptrollerCandidates = [comptrollerAddress];

    const resolved = await service.resolveComptrollerAddress();
    expect(resolved).toBe(comptrollerAddress);
  });

  test('resolveComptrollerAddress falls back to qToken seed discovery', async () => {
    const badComptroller = '0x5555555555555555555555555555555555555555';
    const seededComptroller = '0x6666666666666666666666666666666666666666';
    const seedQToken = BENQI.QUSDC;

    const contracts = {
      [badComptroller]: {
        getAllMarkets: jest.fn().mockRejectedValue(new Error('bad comptroller')),
      },
      [seedQToken]: {
        comptroller: jest.fn().mockResolvedValue(seededComptroller),
      },
      [seededComptroller]: {
        getAllMarkets: jest.fn().mockResolvedValue([qTokenAddress]),
      },
      [qTokenAddress]: {
        symbol: jest.fn().mockResolvedValue('qiUSDC'),
        comptroller: jest.fn().mockResolvedValue(seededComptroller),
      },
    };
    mockContracts(contracts);

    const service = new BenqiService(provider);
    service.comptrollerCandidates = [badComptroller];

    const resolved = await service.resolveComptrollerAddress();
    expect(resolved).toBe(seededComptroller);
  });

  test('getBorrowBalance falls back from staticCall to borrowBalanceStored', async () => {
    const contracts = {
      [qTokenAddress]: {
        borrowBalanceCurrent: {
          staticCall: jest.fn().mockRejectedValue(new Error('static call failed')),
        },
        borrowBalanceStored: jest.fn().mockResolvedValue(123n),
      },
    };
    mockContracts(contracts);

    const service = new BenqiService(provider);
    const result = await service.getBorrowBalance(qTokenAddress, accountAddress);

    expect(result).toEqual({
      qTokenAddress,
      accountAddress,
      borrowBalance: '123',
    });
  });

  test('getInterestRates supports block and timestamp style markets', async () => {
    const blockMarketAddress = '0x7777777777777777777777777777777777777777';
    const timestampMarketAddress = '0x8888888888888888888888888888888888888888';

    const contracts = {
      [blockMarketAddress]: {
        supplyRatePerBlock: jest.fn().mockResolvedValue(1000000000n),
        borrowRatePerBlock: jest.fn().mockResolvedValue(2000000000n),
      },
      [timestampMarketAddress]: {
        supplyRatePerBlock: jest.fn().mockRejectedValue(new Error('not supported')),
        borrowRatePerBlock: jest.fn().mockRejectedValue(new Error('not supported')),
        supplyRatePerTimestamp: jest.fn().mockResolvedValue(12345n),
        borrowRatePerTimestamp: jest.fn().mockResolvedValue(54321n),
      },
    };
    mockContracts(contracts);

    const service = new BenqiService(provider);

    const blockRates = await service.getInterestRates(blockMarketAddress);
    expect(blockRates.rateUnit).toBe('block');
    expect(blockRates.supplyApyBps).toBeGreaterThanOrEqual(0);
    expect(blockRates.borrowApyBps).toBeGreaterThanOrEqual(0);

    const timestampRates = await service.getInterestRates(timestampMarketAddress);
    expect(timestampRates.rateUnit).toBe('timestamp');
    expect(timestampRates.supplyRatePerTimestamp).toBe('12345');
    expect(timestampRates.borrowRatePerTimestamp).toBe('54321');
  });

  test('prepareSupply handles native and ERC20 markets', async () => {
    const nativeQToken = '0x9999999999999999999999999999999999999999';
    const erc20QToken = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const amount = '1000';

    const contracts = {
      [nativeQToken]: {
        underlying: jest.fn().mockRejectedValue(new Error('native market')),
        mint: {
          populateTransaction: jest.fn().mockResolvedValue({ data: '0xnative' }),
        },
      },
      [erc20QToken]: {
        underlying: jest.fn().mockResolvedValue(underlyingAddress),
        mint: {
          populateTransaction: jest.fn().mockResolvedValue({ data: '0xerc20' }),
        },
      },
    };
    mockContracts(contracts);

    const service = new BenqiService(provider);

    const nativeTx = await service.prepareSupply(nativeQToken, amount);
    expect(nativeTx.value).toBe(amount);
    expect(nativeTx.data).toBe('0xnative');

    const erc20Tx = await service.prepareSupply(erc20QToken, amount);
    expect(erc20Tx.value).toBe('0');
    expect(erc20Tx.data).toBe('0xerc20');
  });
});
