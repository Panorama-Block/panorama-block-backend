/**
 * Domain Entities - Error Handling
 *
 * Structured error types for swap operations with proper HTTP status codes
 * and error codes for frontend handling.
 */

export enum SwapErrorCode {
  // ===== VALIDATION ERRORS (400) =====
  INVALID_TOKEN_ADDRESS = 'INVALID_TOKEN_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  AMOUNT_TOO_LOW = 'AMOUNT_TOO_LOW',
  INVALID_CHAIN = 'INVALID_CHAIN',
  INVALID_SLIPPAGE = 'INVALID_SLIPPAGE',
  INVALID_DEADLINE = 'INVALID_DEADLINE',
  MISSING_REQUIRED_PARAMS = 'MISSING_REQUIRED_PARAMS',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // ===== ROUTING ERRORS (404) =====
  NO_ROUTE_FOUND = 'NO_ROUTE_FOUND',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',

  // ===== EXECUTION ERRORS (422) =====
  PRICE_IMPACT_TOO_HIGH = 'PRICE_IMPACT_TOO_HIGH',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // ===== RATE LIMITING (429) =====
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // ===== INFRASTRUCTURE ERRORS (500+) =====
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  TIMEOUT = 'TIMEOUT',
  CACHE_ERROR = 'CACHE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // ===== ACCESS CONTROL (401/403) =====
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // ===== SERVICE STATE (503) =====
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE = 'MAINTENANCE',

  // ===== UNKNOWN (500) =====
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom Error class for swap operations
 *
 * Provides structured error information with:
 * - Error code (for programmatic handling)
 * - Human-readable message
 * - HTTP status code
 * - Additional details (optional)
 *
 * @example
 * ```typescript
 * throw new SwapError(
 *   SwapErrorCode.NO_ROUTE_FOUND,
 *   'No route found for ETH → USDC on Ethereum',
 *   {
 *     fromToken: '0x...',
 *     toToken: '0x...',
 *     chainId: 1,
 *   },
 *   404
 * );
 * ```
 */
export class SwapError extends Error {
  public readonly code: SwapErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    code: SwapErrorCode,
    message: string,
    details?: Record<string, any>,
    httpStatus?: number
  ) {
    super(message);
    this.name = 'SwapError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Automatic HTTP status based on error code
    this.httpStatus = httpStatus || this.getDefaultHttpStatus(code);

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get default HTTP status based on error code
   */
  private getDefaultHttpStatus(code: SwapErrorCode): number {
    // 400 - Validation errors
    if ([
      SwapErrorCode.INVALID_TOKEN_ADDRESS,
      SwapErrorCode.INVALID_AMOUNT,
      SwapErrorCode.AMOUNT_TOO_LOW,
      SwapErrorCode.INVALID_CHAIN,
      SwapErrorCode.INVALID_SLIPPAGE,
      SwapErrorCode.INVALID_DEADLINE,
      SwapErrorCode.MISSING_REQUIRED_PARAMS,
      SwapErrorCode.INVALID_REQUEST,
    ].includes(code)) {
      return 400;
    }

    // 404 - Not found
    if ([
      SwapErrorCode.NO_ROUTE_FOUND,
      SwapErrorCode.INSUFFICIENT_LIQUIDITY,
      SwapErrorCode.UNSUPPORTED_CHAIN,
      SwapErrorCode.UNSUPPORTED_TOKEN,
    ].includes(code)) {
      return 404;
    }

    // 422 - Unprocessable entity
    if ([
      SwapErrorCode.PRICE_IMPACT_TOO_HIGH,
      SwapErrorCode.SLIPPAGE_TOO_HIGH,
      SwapErrorCode.APPROVAL_REQUIRED,
      SwapErrorCode.INSUFFICIENT_BALANCE,
    ].includes(code)) {
      return 422;
    }

    // 429 - Rate limit
    if ([
      SwapErrorCode.RATE_LIMIT_EXCEEDED,
      SwapErrorCode.QUOTA_EXCEEDED,
    ].includes(code)) {
      return 429;
    }

    // 401 - Unauthorized
    if (code === SwapErrorCode.UNAUTHORIZED) {
      return 401;
    }

    // 403 - Forbidden
    if (code === SwapErrorCode.FORBIDDEN) {
      return 403;
    }

    // 503 - Service unavailable
    if ([
      SwapErrorCode.PROVIDER_ERROR,
      SwapErrorCode.RPC_ERROR,
      SwapErrorCode.TIMEOUT,
      SwapErrorCode.SERVICE_UNAVAILABLE,
      SwapErrorCode.MAINTENANCE,
    ].includes(code)) {
      return 503;
    }

    // 500 - Internal server error (default)
    return 500;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      SwapErrorCode.TIMEOUT,
      SwapErrorCode.RPC_ERROR,
      SwapErrorCode.PROVIDER_ERROR,
      SwapErrorCode.RATE_LIMIT_EXCEEDED,
    ].includes(this.code);
  }

  /**
   * Check if error is client error (4xx)
   */
  isClientError(): boolean {
    return this.httpStatus >= 400 && this.httpStatus < 500;
  }

  /**
   * Check if error is server error (5xx)
   */
  isServerError(): boolean {
    return this.httpStatus >= 500;
  }
}

/**
 * Helper functions to create common errors
 */

export function createNoRouteError(fromToken: string, toToken: string, chainId: number): SwapError {
  return new SwapError(
    SwapErrorCode.NO_ROUTE_FOUND,
    `No route found for swap from ${fromToken} to ${toToken} on chain ${chainId}`,
    { fromToken, toToken, chainId }
  );
}

export function createInsufficientLiquidityError(fromToken: string, toToken: string): SwapError {
  return new SwapError(
    SwapErrorCode.INSUFFICIENT_LIQUIDITY,
    `Insufficient liquidity for ${fromToken} → ${toToken}`,
    { fromToken, toToken }
  );
}

export function createPriceImpactTooHighError(priceImpact: string, maxAllowed: string = '5'): SwapError {
  return new SwapError(
    SwapErrorCode.PRICE_IMPACT_TOO_HIGH,
    `Price impact ${priceImpact}% exceeds maximum allowed ${maxAllowed}%`,
    { priceImpact, maxAllowed }
  );
}

export function createRateLimitError(retryAfter?: number): SwapError {
  return new SwapError(
    SwapErrorCode.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded. Please try again later.',
    { retryAfter }
  );
}

export function createTimeoutError(operation: string, timeoutMs: number): SwapError {
  return new SwapError(
    SwapErrorCode.TIMEOUT,
    `Operation ${operation} timed out after ${timeoutMs}ms`,
    { operation, timeoutMs }
  );
}

export function createProviderError(provider: string, originalError: Error): SwapError {
  return new SwapError(
    SwapErrorCode.PROVIDER_ERROR,
    `Provider ${provider} error: ${originalError.message}`,
    {
      provider,
      originalError: {
        message: originalError.message,
        stack: originalError.stack,
      },
    }
  );
}

export function createMissingParamsError(requiredParams: string[]): SwapError {
  return new SwapError(
    SwapErrorCode.MISSING_REQUIRED_PARAMS,
    'Missing required parameters for this operation',
    { requiredParams }
  );
}

export function createUnauthorizedError(reason?: string): SwapError {
  return new SwapError(
    SwapErrorCode.UNAUTHORIZED,
    reason || 'User authentication is required for this action'
  );
}

export function createForbiddenError(reason?: string): SwapError {
  return new SwapError(
    SwapErrorCode.FORBIDDEN,
    reason || 'You are not allowed to perform this action'
  );
}

export function createServiceUnavailableError(detail?: string): SwapError {
  return new SwapError(
    SwapErrorCode.SERVICE_UNAVAILABLE,
    detail || 'Service is temporarily unavailable'
  );
}
