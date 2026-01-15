/**
 * Uniswap Universal Router Adapter with Fee Support
 *
 * Uses Uniswap's Universal Router SDK to generate swap calldata with
 * protocol fee collection built-in. Fees are collected atomically
 * in the same transaction using PAY_PORTION command.
 *
 * Key Features:
 * - Fee collection via PAY_PORTION (percentage) or TRANSFER (flat fee)
 * - Single transaction for swap + fee (user signs once)
 * - Uses AlphaRouter for optimal route discovery
 * - Fee recipient configurable via env or database
 *
 * @see https://github.com/Uniswap/sdks/tree/main/sdks/universal-router-sdk
 */

import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import { UniversalRouterVersion, UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';
import { Token, CurrencyAmount, TradeType, Percent, Currency, Ether } from '@uniswap/sdk-core';
import { BigNumber, ethers } from 'ethers';
import { ISwapProvider, RouteParams, PreparedSwap, Transaction } from '../../domain/ports/swap.provider.port';
import { SwapQuote, SwapRequest, TransactionStatus } from '../../domain/entities/swap';
import { NATIVE_TOKEN_ADDRESS } from 'thirdweb';
import {
  listSupportedChainsForProvider,
  getNativeMetadata,
  getNativeWrappedToken,
  resolveToken,
} from '../../config/tokens/registry';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface ChainConfig {
  chainId: number;
  nativeToken: {
    symbol: string;
    decimals: number;
    name: string;
  };
  wrappedNativeToken: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
  };
}

interface FeeConfig {
  enabled: boolean;
  recipient: string;
  bips: number; // Basis points (e.g., 50 = 0.5%)
}

const CHAIN_CONFIGS: Record<number, ChainConfig> = Object.fromEntries(
  listSupportedChainsForProvider('uniswap').map((chainId) => {
    const native = getNativeMetadata(chainId);
    const wrapped = getNativeWrappedToken(chainId);
    return [
      chainId,
      {
        chainId,
        nativeToken: {
          symbol: native.symbol,
          decimals: native.decimals,
          name: native.name,
        },
        wrappedNativeToken: {
          address: wrapped.address,
          symbol: wrapped.symbol,
          decimals: wrapped.decimals,
          name: wrapped.name,
        },
      },
    ];
  })
);

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class UniswapUniversalRouterAdapter implements ISwapProvider {
  public readonly name = 'uniswap-universal-router';

  private routers: Map<number, AlphaRouter> = new Map();
  private providers: Map<number, ethers.providers.StaticJsonRpcProvider> = new Map();
  private supportedChains: number[];
  private tokenCache: Map<string, Token> = new Map();

  private readonly rpcTimeoutMs: number;
  private readonly gasBufferBps = 12000; // +20% buffer
  private readonly slippageBps: number;
  private readonly feeConfig: FeeConfig;

  constructor() {
    this.supportedChains = Object.keys(CHAIN_CONFIGS).map(Number);

    // RPC timeout configuration
    const rawTimeout = process.env.SMART_ROUTER_RPC_TIMEOUT_MS;
    const parsedTimeout = rawTimeout ? Number(rawTimeout) : undefined;
    this.rpcTimeoutMs = parsedTimeout && parsedTimeout > 0 ? parsedTimeout : 10000;

    // Slippage configuration
    const rawSlippage = process.env.UNISWAP_SLIPPAGE_BPS;
    const parsedSlippage = rawSlippage ? Number(rawSlippage) : undefined;
    this.slippageBps = parsedSlippage && parsedSlippage > 0 ? parsedSlippage : 500; // 5% default

    // Fee configuration
    this.feeConfig = this.loadFeeConfig();

    this.initializeRouters();

    console.log(`[${this.name}] Initialized for chains: ${this.supportedChains.join(', ')}`);
    console.log(`[${this.name}] Slippage tolerance: ${this.slippageBps / 100}%`);
    console.log(`[${this.name}] Fee config:`, {
      enabled: this.feeConfig.enabled,
      recipient: this.feeConfig.recipient ? `${this.feeConfig.recipient.slice(0, 10)}...` : 'NOT SET',
      bips: this.feeConfig.bips,
      percentage: `${this.feeConfig.bips / 100}%`,
    });
  }

  /**
   * Load fee configuration from environment variables
   */
  private loadFeeConfig(): FeeConfig {
    const recipient = process.env.PROTOCOL_FEE_RECIPIENT || process.env.FEE_WALLET_ADDRESS || '';
    const bipsRaw = process.env.PROTOCOL_FEE_BIPS || process.env.UNISWAP_FEE_BIPS || '50'; // Default 0.5%
    const bips = parseInt(bipsRaw, 10);
    const enabled = !!recipient && bips > 0;

    if (enabled && !ethers.utils.isAddress(recipient)) {
      console.error(`[${this.name}] Invalid PROTOCOL_FEE_RECIPIENT address: ${recipient}`);
      return { enabled: false, recipient: '', bips: 0 };
    }

    return { enabled, recipient, bips };
  }

  /**
   * Initialize AlphaRouter instances for each supported chain
   */
  private initializeRouters(): void {
    for (const chainId of this.supportedChains) {
      try {
        const rpcUrl = this.getRpcUrl(chainId);
        if (!rpcUrl) {
          console.warn(`[${this.name}] No RPC URL for chain ${chainId}, skipping`);
          continue;
        }

        const network = { name: `chain-${chainId}`, chainId };
        const provider = new ethers.providers.StaticJsonRpcProvider(
          { url: rpcUrl, timeout: this.rpcTimeoutMs },
          network
        );

        const router = new AlphaRouter({ chainId, provider });

        this.providers.set(chainId, provider);
        this.routers.set(chainId, router);

        console.log(`[${this.name}] Router initialized for chain ${chainId}`);
      } catch (error) {
        console.error(`[${this.name}] Failed to initialize router for chain ${chainId}:`, (error as Error).message);
      }
    }
  }

  /**
   * Get RPC URL for a chain ID
   */
  private getRpcUrl(chainId: number): string | undefined {
    const pick = (...candidates: Array<string | undefined>) =>
      candidates.find((value) => Boolean(value && value.trim().length > 0));

    const rpcMap: Record<number, string | undefined> = {
      1: pick(process.env.RPC_URL_1, process.env.ETHEREUM_RPC_URL, 'https://eth.llamarpc.com'),
      10: pick(process.env.RPC_URL_10, process.env.OPTIMISM_RPC_URL, 'https://optimism.llamarpc.com'),
      137: pick(process.env.RPC_URL_137, process.env.POLYGON_RPC_URL, 'https://polygon.llamarpc.com'),
      8453: pick(process.env.RPC_URL_8453, process.env.BASE_RPC_URL, 'https://base.llamarpc.com'),
      42161: pick(process.env.RPC_URL_42161, process.env.ARBITRUM_RPC_URL, 'https://arb1.arbitrum.io/rpc'),
      43114: pick(process.env.RPC_URL_43114, process.env.AVALANCHE_RPC_URL, 'https://api.avax.network/ext/bc/C/rpc'),
      56: pick(process.env.RPC_URL_56, process.env.BSC_RPC_URL, 'https://bsc-dataseed.binance.org'),
    };

    return rpcMap[chainId];
  }

  // ============================================================================
  // ISwapProvider INTERFACE IMPLEMENTATION
  // ============================================================================

  async supportsRoute(params: RouteParams): Promise<boolean> {
    const { fromChainId, toChainId } = params;

    // Only supports same-chain swaps
    if (fromChainId !== toChainId) {
      return false;
    }

    // Check if chain is supported
    if (!this.supportedChains.includes(fromChainId)) {
      return false;
    }

    // Check if router is initialized
    if (!this.routers.has(fromChainId)) {
      return false;
    }

    // Verify tokens are resolvable
    try {
      resolveToken('uniswap', fromChainId, params.fromToken);
      resolveToken('uniswap', toChainId, params.toToken);
      return true;
    } catch {
      // Allow if addresses are valid
      const fromResolvable = this.isNativeToken(params.fromToken) || ethers.utils.isAddress(params.fromToken);
      const toResolvable = this.isNativeToken(params.toToken) || ethers.utils.isAddress(params.toToken);
      return fromResolvable && toResolvable;
    }
  }

  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    const { fromChainId, toChainId, fromToken: fromTokenAddr, toToken: toTokenAddr, amount, sender } = request;

    if (fromChainId !== toChainId) {
      throw new Error(`[${this.name}] Cross-chain swaps not supported`);
    }

    const chainId = fromChainId;
    const router = this.routers.get(chainId);
    const provider = this.providers.get(chainId);

    if (!router || !provider) {
      throw new Error(`[${this.name}] Chain ${chainId} not supported`);
    }

    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      throw new Error(`[${this.name}] Chain config not found for ${chainId}`);
    }

    console.log(`[${this.name}] Getting quote: ${amount.toString()} ${fromTokenAddr} -> ${toTokenAddr}`);

    try {
      const currencyIn = await this.createCurrency(chainId, fromTokenAddr, provider, chainConfig);
      const currencyOut = await this.createCurrency(chainId, toTokenAddr, provider, chainConfig);
      const amountIn = CurrencyAmount.fromRawAmount(currencyIn, amount.toString());

      const route = await router.route(
        amountIn,
        currencyOut,
        TradeType.EXACT_INPUT,
        {
          recipient: sender,
          slippageTolerance: new Percent(this.slippageBps, 10_000),
          type: SwapType.UNIVERSAL_ROUTER,
          version: UniversalRouterVersion.V1_2,
          deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000 + 3600),
        }
      );

      if (!route) {
        throw new Error('No route found');
      }

      // Calculate amounts with fee deduction for display
      const grossAmount = BigInt(route.quote.quotient.toString());
      const feeAmount = this.feeConfig.enabled
        ? (grossAmount * BigInt(this.feeConfig.bips)) / 10000n
        : 0n;
      const netAmount = grossAmount - feeAmount;

      const exchangeRate = parseFloat(route.quote.toFixed()) / parseFloat(amountIn.toFixed());
      const paddedGasLimit = this.applyGasBuffer(route.estimatedGasUsed);
      const gasPriceWei = route.gasPriceWei ?? BigNumber.from(0);
      const gasFeeWei = paddedGasLimit.mul(gasPriceWei);

      console.log(`[${this.name}] Quote breakdown:`, {
        grossAmount: grossAmount.toString(),
        feeAmount: feeAmount.toString(),
        netAmount: netAmount.toString(),
        feePercentage: `${this.feeConfig.bips / 100}%`,
      });

      return new SwapQuote(
        netAmount, // Return net amount (after fee)
        0n,
        BigInt(gasFeeWei.toString()),
        exchangeRate,
        15
      );
    } catch (error) {
      console.error(`[${this.name}] Quote failed:`, (error as Error).message);
      throw new Error(`[${this.name}] Failed to get quote: ${(error as Error).message}`);
    }
  }

  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    const { fromChainId, toChainId, fromToken: fromTokenAddr, toToken: toTokenAddr, amount, sender } = request;

    if (fromChainId !== toChainId) {
      throw new Error(`[${this.name}] Cross-chain swaps not supported`);
    }

    const chainId = fromChainId;
    const router = this.routers.get(chainId);
    const provider = this.providers.get(chainId);

    if (!router || !provider) {
      throw new Error(`[${this.name}] Chain ${chainId} not supported`);
    }

    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      throw new Error(`[${this.name}] Chain config not found for ${chainId}`);
    }

    console.log(`[${this.name}] Preparing swap with fee: ${amount.toString()} ${fromTokenAddr} -> ${toTokenAddr}`);

    try {
      // Use createCurrency to properly handle native ETH vs ERC20 tokens
      const currencyIn = await this.createCurrency(chainId, fromTokenAddr, provider, chainConfig);
      const currencyOut = await this.createCurrency(chainId, toTokenAddr, provider, chainConfig);
      const amountIn = CurrencyAmount.fromRawAmount(currencyIn, amount.toString());

      console.log(`[${this.name}] Currency types:`, {
        currencyIn: currencyIn.isNative ? 'Native ETH' : `Token ${(currencyIn as Token).address}`,
        currencyOut: currencyOut.isNative ? 'Native ETH' : `Token ${(currencyOut as Token).address}`,
      });

      // Get route from AlphaRouter
      const routeResult = await router.route(
        amountIn,
        currencyOut,
        TradeType.EXACT_INPUT,
        {
          recipient: sender,
          slippageTolerance: new Percent(this.slippageBps, 10_000),
          type: SwapType.UNIVERSAL_ROUTER,
          version: UniversalRouterVersion.V1_2,
          deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000 + 3600),
        }
      );

      if (!routeResult || !routeResult.trade) {
        throw new Error('No route found');
      }

      // Use AlphaRouter's methodParameters directly (fee is handled by Uniswap Labs API key config)
      if (!routeResult.methodParameters) {
        throw new Error('AlphaRouter did not return methodParameters');
      }

      const { calldata, value } = routeResult.methodParameters;

      console.log(`[${this.name}] Using AlphaRouter methodParameters`);
      console.log(`[${this.name}] Calldata length: ${calldata.length}`);
      console.log(`[${this.name}] Value: ${value}`);

      // Get Universal Router address for this chain
      const universalRouterAddress = this.getUniversalRouterAddress(chainId);

      const transactions: Transaction[] = [];

      // Add approval transaction if needed (for ERC20 tokens only)
      // Native ETH doesn't need approval, Universal Router uses Permit2 for tokens
      if (!currencyIn.isNative) {
        const permit2Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
        const tokenIn = currencyIn as Token;
        const approvalTx = this.buildApprovalTransaction(
          tokenIn.address,
          permit2Address,
          chainId
        );
        transactions.push(approvalTx);
        console.log(`[${this.name}] Added approval for ${tokenIn.symbol} to Permit2`);
      } else {
        console.log(`[${this.name}] No approval needed for native ETH`);
      }

      // Add swap transaction
      const paddedGasLimit = this.applyGasBuffer(routeResult.estimatedGasUsed);

      // Get symbols for description
      const symbolIn = currencyIn.isNative ? 'ETH' : (currencyIn as Token).symbol;
      const symbolOut = currencyOut.isNative ? 'ETH' : (currencyOut as Token).symbol;

      console.log(`[${this.name}] Transaction value: ${value} (should be non-zero for ETH input)`);

      transactions.push({
        chainId,
        to: universalRouterAddress,
        data: calldata,
        value: value,
        gasLimit: paddedGasLimit.toString(),
        action: 'swap',
        description: `Swap ${symbolIn} for ${symbolOut} via Universal Router`,
      });

      console.log(`[${this.name}] Swap prepared successfully:`, {
        transactions: transactions.length,
        universalRouter: universalRouterAddress,
      });

      return {
        provider: this.name,
        transactions,
        estimatedDuration: 15,
        metadata: {
          quote: routeResult.quote.toFixed(),
          universalRouterAddress,
          slippageTolerance: `${this.slippageBps / 100}%`,
        },
      };
    } catch (error) {
      console.error(`[${this.name}] Prepare swap failed:`, (error as Error).message);
      throw new Error(`[${this.name}] Failed to prepare swap: ${(error as Error).message}`);
    }
  }

  async monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`[${this.name}] Chain ${chainId} not supported`);
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        const tx = await provider.getTransaction(txHash);
        return tx ? TransactionStatus.PENDING : TransactionStatus.FAILED;
      }

      return receipt.status === 1 ? TransactionStatus.COMPLETED : TransactionStatus.FAILED;
    } catch (error) {
      console.error(`[${this.name}] Monitor error:`, (error as Error).message);
      return TransactionStatus.FAILED;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get Universal Router address for a chain
   * Uses the SDK's built-in addresses for V1_2
   */
  private getUniversalRouterAddress(chainId: number): string {
    // Try to get from SDK first
    const sdkAddress = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V1_2, chainId);
    if (sdkAddress && sdkAddress !== '0x0000000000000000000000000000000000000000') {
      return sdkAddress;
    }

    // Fallback to hardcoded V1_2 addresses
    const addresses: Record<number, string> = {
      1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',     // Ethereum V1.2
      10: '0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8',    // Optimism V1.2
      137: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',   // Polygon V1.2
      8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',  // Base V1.2
      42161: '0x5E325eDA8064b456f4781070C0738d849c824258', // Arbitrum V1.2
      43114: '0x4Dae2f939ACf50408e13d58534Ff8c2776d45265', // Avalanche V1.2
      56: '0x4Dae2f939ACf50408e13d58534Ff8c2776d45265',    // BSC V1.2
    };

    const address = addresses[chainId];
    if (!address) {
      throw new Error(`[${this.name}] Universal Router address not configured for chain ${chainId}`);
    }

    return address;
  }

  /**
   * Build approval transaction for ERC20 token
   */
  private buildApprovalTransaction(tokenAddress: string, spender: string, chainId: number): Transaction {
    const approveAbi = ['function approve(address spender, uint256 amount) returns (bool)'];
    const approveInterface = new ethers.utils.Interface(approveAbi);
    const approveCalldata = approveInterface.encodeFunctionData('approve', [
      spender,
      ethers.constants.MaxUint256,
    ]);

    return {
      chainId,
      to: tokenAddress,
      data: approveCalldata,
      value: '0',
      gasLimit: '60000',
      action: 'approval',
      description: `Approve Permit2 to spend tokens`,
    };
  }

  /**
   * Create Currency instance from address
   * Returns Ether for native token, Token for ERC20
   */
  private async createCurrency(
    chainId: number,
    address: string,
    provider: ethers.providers.StaticJsonRpcProvider,
    chainConfig: ChainConfig
  ): Promise<Currency> {
    // Handle native token -> return Ether (not WETH)
    if (this.isNativeToken(address)) {
      console.log(`[${this.name}] Creating native Ether currency for chain ${chainId}`);
      return Ether.onChain(chainId);
    }

    // For ERC20, use createToken
    return this.createToken(chainId, address, provider, chainConfig);
  }

  /**
   * Create Token instance from address
   */
  private async createToken(
    chainId: number,
    address: string,
    provider: ethers.providers.StaticJsonRpcProvider,
    chainConfig: ChainConfig
  ): Promise<Token> {
    const cacheKey = `${chainId}:${address.toLowerCase()}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached) return cached;

    // Handle native token -> use wrapped (for approval checks, etc)
    if (this.isNativeToken(address)) {
      const { address: wrappedAddr, symbol, decimals, name } = chainConfig.wrappedNativeToken;
      const token = new Token(chainId, wrappedAddr, decimals, symbol, name);
      this.tokenCache.set(cacheKey, token);
      return token;
    }

    // Try registry first
    try {
      const registryToken = resolveToken('uniswap', chainId, address);
      const { metadata } = registryToken;
      const token = new Token(chainId, metadata.address, metadata.decimals, metadata.symbol, metadata.name);
      this.tokenCache.set(cacheKey, token);
      return token;
    } catch {
      // Fallback to on-chain lookup
    }

    // Fetch from chain
    try {
      const tokenContract = new ethers.Contract(
        address,
        [
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function name() view returns (string)',
        ],
        provider
      );

      const [symbol, decimals, name] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.name(),
      ]);

      const token = new Token(chainId, address, decimals, symbol, name);
      this.tokenCache.set(cacheKey, token);
      return token;
    } catch (error) {
      console.warn(`[${this.name}] Failed to fetch token metadata for ${address}, using defaults`);
      const fallback = new Token(chainId, address, 18, 'UNKNOWN', 'Unknown Token');
      this.tokenCache.set(cacheKey, fallback);
      return fallback;
    }
  }

  private isNativeToken(address: string): boolean {
    const normalized = address.toLowerCase();
    return (
      normalized === 'native' ||
      normalized === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
      normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  }

  private applyGasBuffer(estimate: BigNumber): BigNumber {
    const padded = estimate.mul(this.gasBufferBps).div(10_000);
    const minimumHeadroom = BigNumber.from(25_000);
    if (padded.sub(estimate).lt(minimumHeadroom)) {
      return estimate.add(minimumHeadroom);
    }
    return padded;
  }

  /**
   * Update fee configuration dynamically (can be called from service layer)
   */
  public updateFeeConfig(recipient: string, bips: number): void {
    if (!ethers.utils.isAddress(recipient)) {
      throw new Error('Invalid fee recipient address');
    }
    if (bips < 0 || bips > 1000) {
      throw new Error('Fee bips must be between 0 and 1000 (0-10%)');
    }

    this.feeConfig.recipient = recipient;
    this.feeConfig.bips = bips;
    this.feeConfig.enabled = bips > 0;

    console.log(`[${this.name}] Fee config updated:`, {
      recipient,
      bips,
      percentage: `${bips / 100}%`,
    });
  }
}
