import { ISwapProvider, RouteParams, PreparedSwap } from '../../domain/ports/swap.provider.port';
import { SwapRequest, SwapQuote } from '../../domain/entities/swap';

/**
 * UniswapProviderAdapter
 *
 * Integra com a Uniswap Trading API (trade-api.gateway.uniswap.org)
 *
 * Suporta:
 * - V2, V3, V4 pools
 * - UniswapX (intent-based swaps)
 * - Routing automático entre protocolos
 *
 * Limitações:
 * - APENAS same-chain swaps (não faz bridges)
 */
export class UniswapProviderAdapter implements ISwapProvider {
  public readonly name = 'uniswap';

  private readonly baseURL = 'https://trade-api.gateway.uniswap.org/v1';
  private readonly apiKey: string;

  // Chains suportadas pela Uniswap (conforme documentação oficial)
  private readonly supportedChains = new Set([
    1,      // Ethereum
    10,     // Optimism
    137,    // Polygon
    8453,   // Base
    42161,  // Arbitrum
    43114,  // Avalanche
    56,     // BSC
    // V4 adiciona: Blast, Zora, World Chain, Ink, Soneium
  ]);

  constructor() {
    this.apiKey = process.env.UNISWAP_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[UniswapProvider] ⚠️ API key not configured - provider disabled');
    }
  }

  async supportsRoute(params: RouteParams): Promise<boolean> {
    // Uniswap só faz SAME-CHAIN swaps
    if (params.fromChainId !== params.toChainId) {
      return false;
    }

    // Check if chain is supported
    if (!this.supportedChains.has(params.fromChainId)) {
      return false;
    }

    // Check API key
    if (!this.apiKey) {
      return false;
    }

    return true;
  }

  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    if (!this.apiKey) {
      throw new Error('Uniswap API key not configured');
    }

    console.log('[UniswapProvider] Getting quote via Trading API');

    const response = await fetch(`${this.baseURL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        type: 'EXACT_INPUT',
        amount: request.amount.toString(),
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        swapper: request.sender,
        slippageTolerance: '0.5' // 0.5% default
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    // Parse response to domain entity (SwapQuote)
    const outputAmount = BigInt(data.quote?.outputAmount || '0');
    const inputAmount = BigInt(data.quote?.inputAmount || request.amount.toString());
    const gasEstimate = data.gasEstimate;

    return new SwapQuote(
      outputAmount,
      BigInt(0), // bridgeFee (N/A para same-chain)
      this.parseGasFee(gasEstimate),
      this.calculateExchangeRate(inputAmount, outputAmount),
      30 // estimatedDuration em segundos (Uniswap é rápido)
    );
  }

  async prepareSwap(request: SwapRequest): Promise<PreparedSwap> {
    if (!this.apiKey) {
      throw new Error('Uniswap API key not configured');
    }

    console.log('[UniswapProvider] Preparing swap transaction');

    // First get a fresh quote to ensure we have the latest data
    await this.getQuote(request);

    // Then prepare the actual transaction
    const response = await fetch(`${this.baseURL}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        type: 'EXACT_INPUT',
        amount: request.amount.toString(),
        tokenInChainId: request.fromChainId,
        tokenOutChainId: request.toChainId,
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        swapper: request.sender,
        slippageTolerance: '0.5'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uniswap prepare error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();

    // Transform Uniswap response to our format
    const transactions = this.parseTransactions(data, request.fromChainId);

    return {
      provider: 'uniswap',
      transactions,
      estimatedDuration: 30,
      expiresAt: data.quote?.permitData?.deadline
        ? new Date(parseInt(data.quote.permitData.deadline) * 1000)
        : undefined
    };
  }

  async monitorTransaction(txHash: string, chainId: number): Promise<string> {
    // TODO: Implementar usando RPC ou API status da Uniswap
    // Para MVP, retornamos PENDING
    console.log(`[UniswapProvider] Monitoring transaction ${txHash} on chain ${chainId}`);
    return 'PENDING';
  }

  private parseGasFee(gasEstimate: any): bigint {
    if (!gasEstimate) return BigInt(300000 * 30_000_000_000); // Fallback

    const gasLimit = BigInt(gasEstimate.gasLimit || gasEstimate.gasUse || 300000);
    const gasPrice = BigInt(gasEstimate.maxFeePerGas || gasEstimate.gasPrice || 30_000_000_000);

    return gasLimit * gasPrice;
  }

  private calculateExchangeRate(inputAmount: bigint, outputAmount: bigint): number {
    if (inputAmount === 0n) return 0;
    return Number(outputAmount) / Number(inputAmount);
  }

  private parseTransactions(apiResponse: any, chainId: number): any[] {
    // Handle different response formats from Uniswap API
    if (apiResponse.transaction) {
      // Single transaction format
      return [{
        chainId,
        to: apiResponse.transaction.to,
        data: apiResponse.transaction.data,
        value: apiResponse.transaction.value || '0',
        gasLimit: apiResponse.transaction.gas || apiResponse.transaction.gasLimit
      }];
    }

    if (apiResponse.transactions) {
      // Multiple transactions format
      return apiResponse.transactions.map((tx: any) => ({
        chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value || '0',
        gasLimit: tx.gas || tx.gasLimit
      }));
    }

    // Fallback - construct from quote data
    return [{
      chainId,
      to: apiResponse.quote?.to || '0x0000000000000000000000000000000000000000',
      data: apiResponse.quote?.data || '0x',
      value: apiResponse.quote?.value || '0',
      gasLimit: apiResponse.gasEstimate?.gasLimit || '300000'
    }];
  }
}