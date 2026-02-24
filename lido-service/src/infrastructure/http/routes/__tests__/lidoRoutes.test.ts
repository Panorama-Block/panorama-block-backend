import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const authenticateSpy = vi.fn((req, _res, next) => {
  req.user = { address: req.body?.userAddress || '0x1111111111111111111111111111111111111111' };
  next();
});
const optionalAuthSpy = vi.fn((_req, _res, next) => next());
const requireBodyUserAddressSpy = vi.fn();

const validateStakeSpy = vi.fn((_req, _res, next) => next());
const validateUnstakeSpy = vi.fn((_req, _res, next) => next());
const validateUserAddressSpy = vi.fn((_req, _res, next) => next());
const validateTxHashSpy = vi.fn((_req, _res, next) => next());
const validateClaimSpy = vi.fn((_req, _res, next) => next());
const validateTxSubmitSpy = vi.fn((_req, _res, next) => next());

const controller = {
  stake: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'stake', body: req.body })),
  unstake: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'unstake', body: req.body })),
  claimRewards: vi.fn((_: any, res: any) => res.status(200).json({ ok: true, route: 'claim-rewards' })),
  getPosition: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'position', params: req.params })),
  getStakingHistory: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'history', params: req.params })),
  getPortfolio: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'portfolio', params: req.params })),
  getWithdrawals: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'withdrawals', params: req.params })),
  claimWithdrawals: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'claim', body: req.body })),
  getProtocolInfo: vi.fn((_: any, res: any) => res.status(200).json({ ok: true, route: 'protocol' })),
  submitTransactionHash: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'submit', body: req.body })),
  getTransactionStatus: vi.fn((req: any, res: any) => res.status(200).json({ ok: true, route: 'tx-status', params: req.params })),
};

vi.mock('../../middleware/auth', () => ({
  AuthMiddleware: {
    authenticate: (...args: any[]) => authenticateSpy(...args),
    optionalAuth: (...args: any[]) => optionalAuthSpy(...args),
    requireBodyUserAddress: (fieldName: string = 'userAddress') => {
      requireBodyUserAddressSpy(fieldName);
      return (_req: any, _res: any, next: any) => next();
    },
  },
}));

vi.mock('../../middleware/validation', () => ({
  ValidationMiddleware: {
    validateStakeRequest: (...args: any[]) => validateStakeSpy(...args),
    validateUnstakeRequest: (...args: any[]) => validateUnstakeSpy(...args),
    validateUserAddress: (...args: any[]) => validateUserAddressSpy(...args),
    validateTransactionHash: (...args: any[]) => validateTxHashSpy(...args),
    validateClaimWithdrawalsRequest: (...args: any[]) => validateClaimSpy(...args),
    validateTransactionSubmitRequest: (...args: any[]) => validateTxSubmitSpy(...args),
  },
}));

vi.mock('../../middleware/errorHandler', () => ({
  ErrorHandler: {
    asyncWrapper: (fn: any) => (req: any, res: any, next: any) =>
      Promise.resolve(fn(req, res, next)).catch(next),
    handle: vi.fn(),
  },
}));

vi.mock('../../controllers/LidoController', () => ({
  LidoController: vi.fn().mockImplementation(() => controller),
}));

describe('LidoRoutes wiring', () => {
  const describeRoutes =
    process.env.CI === 'true' || process.env.ALLOW_SOCKET_TESTS === 'true'
      ? describe
      : describe.skip;

  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { LidoRoutes } = await import('../lidoRoutes');

    app = express();
    app.use(express.json());
    app.use('/api/lido', LidoRoutes);
  });

  describeRoutes('socket-dependent checks', () => {
    test('POST /stake applies auth + body match + validation and calls controller', async () => {
      const response = await request(app).post('/api/lido/stake').send({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '1000000000000000000',
      });

      expect(response.status).toBe(200);
      expect(authenticateSpy).toHaveBeenCalledTimes(1);
      expect(requireBodyUserAddressSpy).toHaveBeenCalledWith('userAddress');
      expect(validateStakeSpy).toHaveBeenCalledTimes(1);
      expect(controller.stake).toHaveBeenCalledTimes(1);
    });

    test('GET /position/:userAddress uses optional auth + address validation', async () => {
      const response = await request(app).get(
        '/api/lido/position/0x1111111111111111111111111111111111111111',
      );

      expect(response.status).toBe(200);
      expect(optionalAuthSpy).toHaveBeenCalledTimes(1);
      expect(validateUserAddressSpy).toHaveBeenCalledTimes(1);
      expect(controller.getPosition).toHaveBeenCalledTimes(1);
    });

    test('POST /withdrawals/claim enforces auth + validation chain', async () => {
      const response = await request(app).post('/api/lido/withdrawals/claim').send({
        userAddress: '0x1111111111111111111111111111111111111111',
        requestIds: ['123'],
      });

      expect(response.status).toBe(200);
      expect(authenticateSpy).toHaveBeenCalledTimes(1);
      expect(validateClaimSpy).toHaveBeenCalledTimes(1);
      expect(controller.claimWithdrawals).toHaveBeenCalledTimes(1);
    });

    test('GET /protocol/info remains public and calls controller directly', async () => {
      const response = await request(app).get('/api/lido/protocol/info');

      expect(response.status).toBe(200);
      expect(response.body?.route).toBe('protocol');
      expect(controller.getProtocolInfo).toHaveBeenCalledTimes(1);
      expect(authenticateSpy).not.toHaveBeenCalled();
    });
  });
});
