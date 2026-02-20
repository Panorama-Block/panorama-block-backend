import { Response } from 'express';

/**
 * Standardized error codes for the lido/staking service.
 * These codes are sent in JSON responses and consumed by the frontend errorMapper.
 */
export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // Balance / amounts
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  AMOUNT_TOO_SMALL: 'AMOUNT_TOO_SMALL',
  AMOUNT_TOO_LARGE: 'AMOUNT_TOO_LARGE',

  // Transaction
  GAS_ESTIMATION_FAILED: 'GAS_ESTIMATION_FAILED',
  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',
  NONCE_TOO_LOW: 'NONCE_TOO_LOW',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Network
  RPC_ERROR: 'RPC_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Send a standardized error response.
 */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): void {
  const body: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details) {
    (body.error as Record<string, unknown>).details = details;
  }
  res.status(status).json(body);
}
