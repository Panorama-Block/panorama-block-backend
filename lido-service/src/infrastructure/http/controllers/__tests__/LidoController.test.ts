import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ERROR_CODES } from '../../../../shared/errorCodes';

import { LidoController } from '../LidoController';

function createResponseMock(): Response {
  const res = {} as Response;
  (res.status as any) = vi.fn().mockReturnValue(res);
  (res.json as any) = vi.fn().mockReturnValue(res);
  return res;
}

describe('LidoController', () => {
  let controller: any;

  beforeEach(() => {
    vi.spyOn(LidoController.prototype as any, 'initializeServices').mockImplementation(function (this: any) {
      this.lidoService = {};
      this.stakeUseCase = {};
      this.unstakeUseCase = {};
      this.getPositionUseCase = {};
    });

    controller = new LidoController() as any;
    controller.stakeUseCase = { execute: vi.fn() };
    controller.unstakeUseCase = { execute: vi.fn() };
    controller.getPositionUseCase = { execute: vi.fn() };
    controller.lidoService = {
      claimRewards: vi.fn(),
      getStakingHistory: vi.fn(),
      getPortfolioAssets: vi.fn(),
      getPortfolioDailyMetrics: vi.fn(),
      getWithdrawalRequests: vi.fn(),
      claimWithdrawals: vi.fn(),
      submitTransactionHash: vi.fn(),
      getProtocolInfo: vi.fn(),
      getTransactionStatus: vi.fn(),
    };
  });

  test('stake returns 400 when required fields are missing', async () => {
    const req = { body: { userAddress: '0x111' } } as Request;
    const res = createResponseMock();

    await controller.stake(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ERROR_CODES.INVALID_AMOUNT,
        }),
      }),
    );
  });

  test('stake returns success payload and maps service errors to standardized code', async () => {
    const req = {
      body: {
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '1',
      },
    } as Request;

    const successRes = createResponseMock();
    controller.stakeUseCase.execute.mockResolvedValueOnce({
      success: true,
      transaction: { id: 'tx_1', amount: '1' },
    });

    await controller.stake(req, successRes);

    expect(successRes.status).toHaveBeenCalledWith(200);
    expect(successRes.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 'tx_1', amount: '1' },
    });

    const errorRes = createResponseMock();
    controller.stakeUseCase.execute.mockResolvedValueOnce({
      success: false,
      error: 'Insufficient balance',
    });

    await controller.stake(req, errorRes);

    expect(errorRes.status).toHaveBeenCalledWith(400);
    expect(errorRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ERROR_CODES.INSUFFICIENT_BALANCE,
        }),
      }),
    );
  });

  test('claimWithdrawals maps client-side validation errors to 400', async () => {
    const req = {
      body: {
        userAddress: '0x1111111111111111111111111111111111111111',
        requestIds: ['123'],
      },
    } as Request;
    const res = createResponseMock();

    controller.lidoService.claimWithdrawals.mockRejectedValueOnce(
      new Error('Withdrawal request is not finalized yet. Please wait and try again.'),
    );

    await controller.claimWithdrawals(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/not finalized/i),
      }),
    );
  });

  test('submitTransactionHash returns 404 when transaction is missing', async () => {
    const req = {
      body: {
        id: 'tx_missing',
        userAddress: '0x1111111111111111111111111111111111111111',
        transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    } as Request;
    const res = createResponseMock();

    controller.lidoService.submitTransactionHash.mockRejectedValueOnce(new Error('Transaction not found'));

    await controller.submitTransactionHash(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Transaction not found',
    });
  });
});
