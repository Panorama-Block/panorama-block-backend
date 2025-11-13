// TAC Quote Service - Cross-chain quote generation and management
import { CrossChainQuote, QuoteRoute, QuoteAlternative } from '../../domain/entities/CrossChainQuote';
import { TacOperationType } from '../../domain/entities/TacOperation';
import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacSdkBridgeService } from '../../domain/interfaces/ITacSdkBridgeService';
import { IBridgeProviderService } from '../../domain/interfaces/IBridgeProviderService';
import { logger, createRequestLogger } from '../../infrastructure/utils/logger';

export interface QuoteRequest {
  userId: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: number;
  operationType: TacOperationType;
  slippage?: number;
  prioritizeSpeed?: boolean;
  preferredProtocols?: string[];
  blacklistedProtocols?: string[];
}

export interface QuoteResponse {
  quote: CrossChainQuote;
  alternatives: QuoteAlternative[];
  estimatedSavings?: {
    cheapestRoute: QuoteRoute;
    fastestRoute: QuoteRoute;
    balancedRoute: QuoteRoute;
  };
}

export class TacQuoteService {
  constructor(
    private tacRepository: ITacRepository,
    private tacSdkService: ITacSdkBridgeService,
    private bridgeProviderService: IBridgeProviderService
  ) {}

  async generateQuote(request: QuoteRequest, traceId?: string): Promise<QuoteResponse> {
    const requestLogger = createRequestLogger(traceId || '', request.userId);

    try {
      requestLogger.info('Generating cross-chain quote', {
        fromChain: request.fromChain,
        toChain: request.toChain,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: request.amount,
        operationType: request.operationType
      });

      // Get quotes from multiple providers
      const [tacQuote, alternativeQuotes] = await Promise.all([
        this.getTacSdkQuote(request),
        this.getAlternativeQuotes(request)
      ]);

      // Select the best primary route
      const primaryRoute = this.selectPrimaryRoute(tacQuote, request);

      // Create quote entity
      const quote = new CrossChainQuote({
        userId: request.userId,
        fromChain: request.fromChain,
        toChain: request.toChain,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amount: request.amount,
        operationType: request.operationType,
        route: primaryRoute,
        alternatives: alternativeQuotes
      });

      // Save quote to repository
      const savedQuote = await this.tacRepository.saveQuote(quote);

      // Calculate route comparisons
      const estimatedSavings = this.calculateRouteSavings(primaryRoute, alternativeQuotes);

      requestLogger.info('Cross-chain quote generated successfully', {
        quoteId: savedQuote.id,
        estimatedOutput: primaryRoute.estimatedOutput,
        totalFees: primaryRoute.totalFees,
        estimatedTime: primaryRoute.estimatedTime
      });

      return {
        quote: savedQuote,
        alternatives: alternativeQuotes,
        estimatedSavings
      };

    } catch (error) {
      requestLogger.error('Failed to generate cross-chain quote', { error: error.message });
      throw new Error(`Quote generation failed: ${error.message}`);
    }
  }

  async getQuote(quoteId: string): Promise<CrossChainQuote | null> {
    return await this.tacRepository.findQuoteById(quoteId);
  }

  async getUserQuotes(
    userId: string,
    includeExpired: boolean = false,
    limit: number = 20
  ): Promise<CrossChainQuote[]> {
    return await this.tacRepository.findUserQuotes(userId, includeExpired, limit);
  }

  async refreshQuote(quoteId: string): Promise<CrossChainQuote> {
    const existingQuote = await this.tacRepository.findQuoteById(quoteId);
    if (!existingQuote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    if (existingQuote.isExecuted) {
      throw new Error('Cannot refresh executed quote');
    }

    // Generate new quote with same parameters
    const refreshRequest: QuoteRequest = {
      userId: existingQuote.userId,
      fromChain: existingQuote.fromChain,
      toChain: existingQuote.toChain,
      fromToken: existingQuote.fromToken,
      toToken: existingQuote.toToken,
      amount: existingQuote.amount,
      operationType: existingQuote.operationType
    };

    const refreshResponse = await this.generateQuote(refreshRequest);

    // Mark old quote as expired
    existingQuote.expire();
    await this.tacRepository.updateQuote(existingQuote);

    return refreshResponse.quote;
  }

  async executeQuote(quoteId: string, userId: string): Promise<string> {
    const quote = await this.tacRepository.findQuoteById(quoteId);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    if (quote.userId !== userId) {
      throw new Error('Unauthorized: Cannot execute quote for another user');
    }

    if (quote.isExecuted) {
      throw new Error('Quote already executed');
    }

    if (quote.isExpired()) {
      throw new Error('Quote has expired');
    }

    const requestLogger = createRequestLogger('', userId);

    try {
      requestLogger.info('Executing cross-chain quote', { quoteId });

      // Mark quote as executed
      quote.execute();
      await this.tacRepository.updateQuote(quote);

      // Create operation from quote
      const operationId = await this.createOperationFromQuote(quote);

      requestLogger.info('Quote executed successfully', { quoteId, operationId });

      return operationId;

    } catch (error) {
      requestLogger.error('Failed to execute quote', { quoteId, error: error.message });
      throw new Error(`Quote execution failed: ${error.message}`);
    }
  }

  async compareProviders(request: QuoteRequest): Promise<{
    providers: Array<{
      name: string;
      route: QuoteRoute;
      pros: string[];
      cons: string[];
      recommendation: 'best_price' | 'fastest' | 'most_reliable' | 'balanced';
    }>;
  }> {
    const quotes = await Promise.all([
      this.getTacSdkQuote(request),
      ...await this.getAlternativeQuotes(request)
    ]);

    const providers = quotes.map(route => {
      const analysis = this.analyzeRoute(route, quotes);
      return {
        name: route.provider,
        route,
        pros: analysis.pros,
        cons: analysis.cons,
        recommendation: analysis.recommendation
      };
    });

    return { providers };
  }

  private async getTacSdkQuote(request: QuoteRequest): Promise<QuoteRoute> {
    const quoteRequest = {
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amount: request.amount,
      slippage: request.slippage || 0.5
    };

    const tacQuote = await this.tacSdkService.getQuote(quoteRequest);

    return {
      provider: 'tac',
      protocolSteps: this.getProtocolStepsForOperation(request.operationType, request.fromToken, request.toToken),
      estimatedOutput: tacQuote.estimatedOutput,
      priceImpact: tacQuote.priceImpact || 0,
      totalFees: tacQuote.fees,
      estimatedTime: tacQuote.estimatedTime,
      confidence: 95,
      metadata: {
        tacTransactionId: tacQuote.transactionId,
        bridgeProvider: 'tac',
        ...tacQuote.metadata
      }
    };
  }

  private async getAlternativeQuotes(request: QuoteRequest): Promise<QuoteAlternative[]> {
    const providers = await this.bridgeProviderService.getActiveProviders(
      request.fromChain,
      request.toChain,
      [request.fromToken, request.toToken]
    );

    const alternativeQuotes = await Promise.allSettled(
      providers
        .filter(p => p.name !== 'tac') // Exclude TAC as it's the primary
        .map(async provider => {
          try {
            const quote = await this.bridgeProviderService.getQuote(provider.name, {
              fromChain: request.fromChain,
              toChain: request.toChain,
              fromToken: request.fromToken,
              toToken: request.toToken,
              amount: request.amount
            });

            return {
              provider: provider.name,
              route: {
                provider: provider.name,
                protocolSteps: quote.steps || [],
                estimatedOutput: quote.estimatedOutput,
                priceImpact: quote.priceImpact || 0,
                totalFees: quote.fees,
                estimatedTime: quote.estimatedTime,
                confidence: quote.confidence || 80,
                metadata: quote.metadata || {}
              },
              savings: 0, // Will be calculated later
              tradeOffs: quote.tradeOffs || []
            };
          } catch (error) {
            logger.warn(`Failed to get quote from provider ${provider.name}:`, error.message);
            return null;
          }
        })
    );

    return alternativeQuotes
      .filter((result): result is PromiseFulfilledResult<QuoteAlternative> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  private selectPrimaryRoute(tacRoute: QuoteRoute, request: QuoteRequest): QuoteRoute {
    // TAC is always preferred as primary route for now
    // In the future, this could be more sophisticated based on user preferences
    return tacRoute;
  }

  private calculateRouteSavings(
    primaryRoute: QuoteRoute,
    alternatives: QuoteAlternative[]
  ): {
    cheapestRoute: QuoteRoute;
    fastestRoute: QuoteRoute;
    balancedRoute: QuoteRoute;
  } | undefined {
    if (alternatives.length === 0) return undefined;

    const allRoutes = [primaryRoute, ...alternatives.map(alt => alt.route)];

    // Find cheapest (highest output after fees)
    const cheapestRoute = allRoutes.reduce((best, current) =>
      (current.estimatedOutput - current.totalFees) > (best.estimatedOutput - best.totalFees)
        ? current
        : best
    );

    // Find fastest
    const fastestRoute = allRoutes.reduce((best, current) =>
      current.estimatedTime < best.estimatedTime ? current : best
    );

    // Find balanced (best combination of speed and cost)
    const balancedRoute = allRoutes.reduce((best, current) => {
      const currentScore = this.calculateBalanceScore(current);
      const bestScore = this.calculateBalanceScore(best);
      return currentScore > bestScore ? current : best;
    });

    return { cheapestRoute, fastestRoute, balancedRoute };
  }

  private calculateBalanceScore(route: QuoteRoute): number {
    // Simple scoring: normalize output and time, then combine
    const outputScore = route.estimatedOutput - route.totalFees;
    const timeScore = 1 / (route.estimatedTime + 1); // Inverse of time (faster = higher score)
    const confidenceScore = route.confidence / 100;

    return (outputScore * 0.4) + (timeScore * 0.4) + (confidenceScore * 0.2);
  }

  private getProtocolStepsForOperation(
    operationType: TacOperationType,
    fromToken: string,
    toToken: string
  ): any[] {
    switch (operationType) {
      case 'cross_chain_swap':
        return [
          { protocol: 'bridge', action: 'bridge_to_evm', token: fromToken },
          { protocol: 'uniswap', action: 'swap', fromToken, toToken },
          { protocol: 'bridge', action: 'bridge_to_ton', token: toToken }
        ];

      case 'cross_chain_lending':
        return [
          { protocol: 'bridge', action: 'bridge_to_evm', token: fromToken },
          { protocol: 'benqi', action: 'supply', token: fromToken }
        ];

      case 'cross_chain_staking':
        return [
          { protocol: 'bridge', action: 'bridge_to_evm', token: fromToken },
          { protocol: 'lido', action: 'stake', token: fromToken }
        ];

      default:
        return [];
    }
  }

  private analyzeRoute(route: QuoteRoute, allRoutes: QuoteRoute[]): {
    pros: string[];
    cons: string[];
    recommendation: 'best_price' | 'fastest' | 'most_reliable' | 'balanced';
  } {
    const pros: string[] = [];
    const cons: string[] = [];

    // Analyze vs other routes
    const isCheapest = allRoutes.every(r =>
      r === route || (route.estimatedOutput - route.totalFees) >= (r.estimatedOutput - r.totalFees)
    );
    const isFastest = allRoutes.every(r => r === route || route.estimatedTime <= r.estimatedTime);
    const hasBestConfidence = allRoutes.every(r => r === route || route.confidence >= r.confidence);

    if (isCheapest) pros.push('Best price');
    if (isFastest) pros.push('Fastest execution');
    if (hasBestConfidence) pros.push('Most reliable');
    if (route.provider === 'tac') pros.push('Native TAC integration');

    // Analyze potential cons
    if (!isFastest && route.estimatedTime > 300) cons.push('Slower execution');
    if (!isCheapest && route.totalFees > 10) cons.push('Higher fees');
    if (route.confidence < 90) cons.push('Lower confidence');

    // Determine recommendation
    let recommendation: 'best_price' | 'fastest' | 'most_reliable' | 'balanced' = 'balanced';
    if (isCheapest && !isFastest) recommendation = 'best_price';
    else if (isFastest && !isCheapest) recommendation = 'fastest';
    else if (hasBestConfidence) recommendation = 'most_reliable';

    return { pros, cons, recommendation };
  }

  private async createOperationFromQuote(quote: CrossChainQuote): Promise<string> {
    // This would call the TacOperationService to create an operation
    // For now, we'll just return a mock operation ID
    return `op_${Date.now()}_${quote.id.slice(-6)}`;
  }
}