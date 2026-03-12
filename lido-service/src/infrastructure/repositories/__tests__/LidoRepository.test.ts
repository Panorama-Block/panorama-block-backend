import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ethers } from 'ethers';
import { LIDO_CONTRACTS } from '../../config/lidoContracts';

const {
  mockContractFactory,
  mockAxiosGet,
  mockCircuitBreakerExecute,
  mockEthereumConfig,
  mockDbQuery,
  mockDbTransaction,
  mockDbIsConfigured,
  mockDbGetInstance,
} = vi.hoisted(() => {
  const mockContractFactory = vi.fn();
  const mockAxiosGet = vi.fn();
  const mockCircuitBreakerExecute = vi.fn(async <T>(fn: () => Promise<T>) => fn());

  const mockEthereumConfig = {
    getProvider: vi.fn(() => ({ kind: 'provider' })),
    getChainId: vi.fn(() => 1),
    circuitBreaker: {
      execute: mockCircuitBreakerExecute,
      isOpen: false,
    },
  };

  const mockDbQuery = vi.fn();
  const mockDbTransaction = vi.fn();
  const mockDbInstance = {
    query: mockDbQuery,
    transaction: mockDbTransaction,
  };
  const mockDbIsConfigured = vi.fn(() => true);
  const mockDbGetInstance = vi.fn(() => mockDbInstance);

  return {
    mockContractFactory,
    mockAxiosGet,
    mockCircuitBreakerExecute,
    mockEthereumConfig,
    mockDbQuery,
    mockDbTransaction,
    mockDbIsConfigured,
    mockDbGetInstance,
  };
});

vi.mock('axios', () => ({
  default: { get: mockAxiosGet },
  get: mockAxiosGet,
}));

vi.mock('../../config/ethereum', () => ({
  EthereumConfig: {
    getInstance: vi.fn(() => mockEthereumConfig),
  },
}));

vi.mock('../../database/database.service', () => ({
  DatabaseService: {
    isConfigured: mockDbIsConfigured,
    getInstance: mockDbGetInstance,
  },
}));

vi.mock('../../logs/logger', () => ({
  Logger: class Logger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
  },
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: vi.fn((...args: unknown[]) => mockContractFactory(...args)),
    },
  };
});

type ContractMap = Record<string, any>;

function setContractMap(map: ContractMap) {
  mockContractFactory.mockImplementation((address: string) => {
    const key = String(address).toLowerCase();
    const contract = map[key];
    if (!contract) {
      throw new Error(`Unexpected contract for address ${address}`);
    }
    return contract;
  });
}

function baseContracts(overrides: Partial<ContractMap> = {}): ContractMap {
  const stEthAddress = LIDO_CONTRACTS.STETH.toLowerCase();
  const wstEthAddress = LIDO_CONTRACTS.WSTETH.toLowerCase();
  const queueAddress = LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase();

  return {
    [stEthAddress]: {
      allowance: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
      balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
      getTotalPooledEther: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
      populateTransaction: {
        approve: vi.fn().mockResolvedValue({ to: LIDO_CONTRACTS.STETH, data: '0xapprove' }),
      },
    },
    [wstEthAddress]: {
      balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
      getStETHByWstETH: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
    },
    [queueAddress]: {
      getWithdrawalStatus: vi.fn().mockResolvedValue([]),
      getLastCheckpointIndex: vi.fn().mockResolvedValue(ethers.BigNumber.from('1')),
      findCheckpointHints: vi.fn().mockResolvedValue([ethers.BigNumber.from('1')]),
      populateTransaction: {
        requestWithdrawals: vi.fn().mockResolvedValue({ to: LIDO_CONTRACTS.WITHDRAWAL_QUEUE, data: '0xreq' }),
        claimWithdrawals: vi.fn().mockResolvedValue({ to: LIDO_CONTRACTS.WITHDRAWAL_QUEUE, data: '0xclaim' }),
      },
    },
    ...overrides,
  };
}

describe('LidoRepository', () => {
  const userAddress = '0x1111111111111111111111111111111111111111';
  let LidoRepository: typeof import('../LidoRepository').LidoRepository;

  beforeEach(async () => {
    if (!LidoRepository) {
      ({ LidoRepository } = await import('../LidoRepository'));
    }

    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockDbTransaction.mockImplementation(async (callback: (client: { query: typeof mockDbQuery }) => Promise<any>) => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      return callback({ query: clientQuery });
    });
    mockAxiosGet.mockReset();
    mockCircuitBreakerExecute.mockImplementation(async <T>(fn: () => Promise<T>) => fn());
  });

  test('unstake prepares approval when allowance is insufficient', async () => {
    const contracts = baseContracts({
      [LIDO_CONTRACTS.STETH.toLowerCase()]: {
        allowance: vi.fn().mockResolvedValue(ethers.BigNumber.from('0')),
        balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('2000000000000000000')),
        populateTransaction: {
          approve: vi.fn().mockResolvedValue({ to: LIDO_CONTRACTS.STETH, data: '0xapprove' }),
        },
      },
    });

    setContractMap(contracts);
    const repository = new LidoRepository();
    const tx = await repository.unstake(userAddress, '1000000000000000000');

    expect(tx.type).toBe('unstake_approval');
    expect(tx.requiresFollowUp).toBe(true);
    expect(tx.followUpAction).toBe('unstake');
    expect(tx.transactionData?.to).toBe(LIDO_CONTRACTS.STETH);
  });

  test('unstake prepares withdrawal request when allowance is sufficient', async () => {
    const contracts = baseContracts({
      [LIDO_CONTRACTS.STETH.toLowerCase()]: {
        allowance: vi.fn().mockResolvedValue(ethers.BigNumber.from('2000000000000000000')),
        balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('2000000000000000000')),
      },
      [LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()]: {
        populateTransaction: {
          requestWithdrawals: vi.fn().mockResolvedValue({
            to: LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
            data: '0xrequest',
          }),
          claimWithdrawals: vi.fn().mockResolvedValue({
            to: LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
            data: '0xclaim',
          }),
        },
        getWithdrawalStatus: vi.fn().mockResolvedValue([]),
        getLastCheckpointIndex: vi.fn().mockResolvedValue(ethers.BigNumber.from('1')),
        findCheckpointHints: vi.fn().mockResolvedValue([ethers.BigNumber.from('1')]),
      },
    });

    setContractMap(contracts);
    const repository = new LidoRepository();
    const tx = await repository.unstake(userAddress, '1000000000000000000');

    expect(tx.type).toBe('unstake');
    expect(tx.requiresFollowUp).toBeUndefined();
    expect(tx.transactionData?.to).toBe(LIDO_CONTRACTS.WITHDRAWAL_QUEUE);
  });

  test('getStakingPosition returns wei balances and persists snapshot', async () => {
    const transactionQueries: string[] = [];
    mockDbTransaction.mockImplementation(async (callback: (client: { query: any }) => Promise<any>) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          transactionQueries.push(sql);
          return { rows: [], rowCount: 1 };
        }),
      };
      return callback(client);
    });

    mockAxiosGet.mockResolvedValueOnce({ data: { apr: 3.45 } });

    const contracts = baseContracts({
      [LIDO_CONTRACTS.STETH.toLowerCase()]: {
        balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('1000')),
        getTotalPooledEther: vi.fn().mockResolvedValue(ethers.BigNumber.from('999999')),
      },
      [LIDO_CONTRACTS.WSTETH.toLowerCase()]: {
        balanceOf: vi.fn().mockResolvedValue(ethers.BigNumber.from('200')),
        getStETHByWstETH: vi.fn().mockResolvedValue(ethers.BigNumber.from('300')),
      },
    });

    setContractMap(contracts);
    const repository = new LidoRepository();
    const position = await repository.getStakingPosition(userAddress);

    expect(position).toBeTruthy();
    expect(position?.stETHBalance).toBe('1000');
    expect(position?.wstETHBalance).toBe('200');
    expect(position?.stakedAmount).toBe('1300');
    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(transactionQueries.join('\n')).toContain('INSERT INTO lido_positions_current');
  });

  test('getCurrentAPY falls back across sources and caches successful value', async () => {
    const contracts = baseContracts();
    setContractMap(contracts);
    const repository = new LidoRepository();

    mockAxiosGet
      .mockRejectedValueOnce(new Error('stake.lido.fi unavailable'))
      .mockResolvedValueOnce({ data: { data: { apr: '4.21' } } });

    const first = await repository.getCurrentAPY();
    const second = await repository.getCurrentAPY();

    expect(first).toBe(4.21);
    expect(second).toBe(4.21);
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  test('claimWithdrawals validates owner/finalization/claimed states', async () => {
    const commonContracts = baseContracts();

    setContractMap({
      ...commonContracts,
      [LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()]: {
        ...commonContracts[LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()],
        getWithdrawalStatus: vi.fn().mockResolvedValue([
          {
            owner: '0x2222222222222222222222222222222222222222',
            isFinalized: true,
            isClaimed: false,
          },
        ]),
      },
    });
    await expect(new LidoRepository().claimWithdrawals(userAddress, ['1'])).rejects.toThrow(
      /do not belong/i,
    );

    setContractMap({
      ...commonContracts,
      [LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()]: {
        ...commonContracts[LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()],
        getWithdrawalStatus: vi.fn().mockResolvedValue([
          {
            owner: ethers.utils.getAddress(userAddress),
            isFinalized: false,
            isClaimed: false,
          },
        ]),
      },
    });
    await expect(new LidoRepository().claimWithdrawals(userAddress, ['1'])).rejects.toThrow(
      /not finalized/i,
    );

    setContractMap({
      ...commonContracts,
      [LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()]: {
        ...commonContracts[LIDO_CONTRACTS.WITHDRAWAL_QUEUE.toLowerCase()],
        getWithdrawalStatus: vi.fn().mockResolvedValue([
          {
            owner: ethers.utils.getAddress(userAddress),
            isFinalized: true,
            isClaimed: true,
          },
        ]),
      },
    });
    await expect(new LidoRepository().claimWithdrawals(userAddress, ['1'])).rejects.toThrow(
      /already claimed/i,
    );
  });
});
