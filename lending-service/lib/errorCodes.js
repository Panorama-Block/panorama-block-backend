/**
 * Standardized error codes for the lending service.
 * These codes are sent in JSON responses and consumed by the frontend errorMapper.
 */

const ERROR_CODES = Object.freeze({
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // Balance / amounts
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_COLLATERAL: 'INSUFFICIENT_COLLATERAL',
  INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
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

  // Validation contract
  TAX_TRANSFER_FAILED: 'TAX_TRANSFER_FAILED',
  NO_AVAX_SENT: 'NO_AVAX_SENT',

  // Lending specific
  HEALTH_FACTOR_TOO_LOW: 'HEALTH_FACTOR_TOO_LOW',
  MARKET_NOT_FOUND: 'MARKET_NOT_FOUND',
  BORROW_CAP_REACHED: 'BORROW_CAP_REACHED',
});

/**
 * Create a standardized error response object.
 *
 * @param {number} status - HTTP status code
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable error message
 * @param {object} [details] - Optional additional details
 * @returns {{ success: false, error: { code: string, message: string, details?: object } }}
 */
function errorResponse(status, code, message, details) {
  const body = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details !== undefined) {
    body.error.details = details;
  }
  return { status, body };
}

/**
 * Send a standardized error response.
 *
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 */
function sendError(res, status, code, message, details) {
  const { body } = errorResponse(status, code, message, details);
  return res.status(status).json(body);
}

module.exports = { ERROR_CODES, errorResponse, sendError };
