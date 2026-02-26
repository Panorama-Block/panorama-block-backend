import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { ValidationMiddleware } from '../validation';

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function createMockResponse(): MockResponse {
  const response = {} as MockResponse;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function runStakeValidation(body: Record<string, unknown>) {
  const req = { body } as Request;
  const res = createMockResponse();
  const next = vi.fn() as unknown as NextFunction;

  ValidationMiddleware.validateStakeRequest(req, res, next);
  return { res, next };
}

function runUnstakeValidation(body: Record<string, unknown>) {
  const req = { body } as Request;
  const res = createMockResponse();
  const next = vi.fn() as unknown as NextFunction;

  ValidationMiddleware.validateUnstakeRequest(req, res, next);
  return { res, next };
}

describe('ValidationMiddleware', () => {
  describe('validateStakeRequest', () => {
    it('accepts valid wei amount', () => {
      const { res, next } = runStakeValidation({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '1567000000000000',
      });

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects amount larger than 1,000,000 ETH in wei', () => {
      const { res, next } = runStakeValidation({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '1000000000000000000000001',
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Amount too large (maximum 1,000,000 ETH)',
      });
    });

    it('rejects decimal values (expects wei integer string)', () => {
      const { res, next } = runStakeValidation({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '0.001',
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Amount must be a positive wei value',
      });
    });
  });

  describe('validateUnstakeRequest', () => {
    it('accepts valid wei amount', () => {
      const { res, next } = runUnstakeValidation({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: '1000000000000000',
      });

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects invalid wei amount', () => {
      const { res, next } = runUnstakeValidation({
        userAddress: '0x1111111111111111111111111111111111111111',
        amount: 'abc',
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Amount must be a positive wei value',
      });
    });
  });
});
