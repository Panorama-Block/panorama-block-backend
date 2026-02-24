/**
 * Simple circuit breaker for RPC calls.
 * After `threshold` consecutive failures, the circuit opens for `cooldownMs`.
 * While open, calls fail fast without hitting the RPC node.
 */
class RpcCircuitBreaker {
  constructor(threshold = 5, cooldownMs = 30000) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.openUntil = 0;
  }

  get isOpen() {
    if (this.openUntil === 0) return false;
    if (Date.now() >= this.openUntil) {
      // Half-open: allow one attempt
      this.openUntil = 0;
      this.failures = this.threshold - 1;
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      console.warn(
        `[CIRCUIT-BREAKER] OPEN after ${this.failures} failures. Cooldown ${this.cooldownMs / 1000}s.`
      );
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  status() {
    return {
      state: this.isOpen ? 'open' : this.failures > 0 ? 'half-open' : 'closed',
      failures: this.failures,
      threshold: this.threshold,
    };
  }

  async execute(fn) {
    if (this.isOpen) {
      throw new Error('RPC circuit breaker is open. The blockchain node is temporarily unavailable.');
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

// Singleton per chain
const breakers = {};

function getCircuitBreaker(chainId = 43114) {
  if (!breakers[chainId]) {
    const threshold = parseInt(process.env.RPC_CB_THRESHOLD || '5');
    const cooldown = parseInt(process.env.RPC_CB_COOLDOWN_MS || '30000');
    breakers[chainId] = new RpcCircuitBreaker(threshold, cooldown);
  }
  return breakers[chainId];
}

function getAllBreakerStatuses() {
  const result = {};
  for (const [chainId, cb] of Object.entries(breakers)) {
    result[chainId] = cb.status();
  }
  return result;
}

module.exports = { RpcCircuitBreaker, getCircuitBreaker, getAllBreakerStatuses };
