import { ethers } from 'ethers';
import { Logger } from '../logs/logger';

/**
 * Simple circuit breaker for RPC calls.
 * After `threshold` consecutive failures, the circuit opens for `cooldownMs`.
 * While open, calls fail fast without hitting the RPC node.
 */
export class RpcCircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly defaultTimeoutMs: number;
  private readonly logger: Logger;

  constructor(threshold = 5, cooldownMs = 30_000, defaultTimeoutMs = 15_000) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.logger = new Logger();
  }

  get isOpen(): boolean {
    if (this.openUntil === 0) return false;
    if (Date.now() >= this.openUntil) {
      // Half-open: allow one attempt
      this.openUntil = 0;
      this.failures = this.threshold - 1; // one more failure re-opens
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.logger.warn(
        `RPC circuit breaker OPEN after ${this.failures} failures. Cooldown ${this.cooldownMs / 1000}s.`,
      );
    }
  }

  /**
   * Execute a function with circuit breaker + timeout protection.
   */
  async execute<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (this.isOpen) {
      throw new Error('RPC circuit breaker is open. The blockchain node is temporarily unavailable.');
    }
    const ms = timeoutMs ?? this.defaultTimeoutMs;
    try {
      const result = await this.withTimeout(fn(), ms);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`RPC call timed out after ${ms}ms`)), ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }
}

export class EthereumConfig {
  private static instance: EthereumConfig;
  private provider!: ethers.providers.JsonRpcProvider;
  private logger: Logger;
  private _circuitBreaker: RpcCircuitBreaker;

  private constructor() {
    this.logger = new Logger();
    this._circuitBreaker = new RpcCircuitBreaker(
      parseInt(process.env.RPC_CB_THRESHOLD || '5'),
      parseInt(process.env.RPC_CB_COOLDOWN_MS || '30000'),
      parseInt(process.env.RPC_CALL_TIMEOUT_MS || '15000'),
    );
    this.initializeProvider();
  }

  public static getInstance(): EthereumConfig {
    if (!EthereumConfig.instance) {
      EthereumConfig.instance = new EthereumConfig();
    }
    return EthereumConfig.instance;
  }

  private initializeProvider(): void {
    try {
      const rpcUrl = process.env.ETHEREUM_RPC_URL;
      if (!rpcUrl) {
        throw new Error('ETHEREUM_RPC_URL environment variable is required');
      }

      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        name: 'mainnet',
        chainId: 1
      });

      this.logger.info('Ethereum provider initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Ethereum provider: ${error}`);
      throw error;
    }
  }

  public getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider;
  }

  public get circuitBreaker(): RpcCircuitBreaker {
    return this._circuitBreaker;
  }

  public getChainId(): number {
    return parseInt(process.env.ETHEREUM_CHAIN_ID || '1');
  }
}
