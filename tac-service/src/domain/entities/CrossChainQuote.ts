import { randomUUID } from 'crypto';

export interface QuoteRoute {
  steps: QuoteStep[];
  totalTime: number; // seconds
  totalFees: QuoteFees;
  priceImpact: string;
  minimumReceived: string;
  provider: string;
}

export interface QuoteStep {
  stepType: 'bridge' | 'swap' | 'protocol';
  fromToken: string;
  toToken: string;
  protocol: string;
  estimatedGas: string;
  estimatedTime: number; // seconds
  chainId?: number;
}

export interface QuoteFees {
  bridgeFees: string;
  gasFees: string;
  protocolFees: string;
  total: string;
}

export interface QuoteAlternative {
  provider: string;
  totalTime: number;
  totalFees: string;
  outputAmount: string;
  confidence: number; // 0-1
}

export interface CrossChainQuoteProps {
  id?: string;
  userId: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  operationType: string;
  route: QuoteRoute;
  alternatives: QuoteAlternative[];
  expiresAt: Date;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

export class CrossChainQuote {
  private readonly props: CrossChainQuoteProps;

  constructor(props: CrossChainQuoteProps) {
    this.props = {
      ...props,
      id: props.id || randomUUID(),
      createdAt: props.createdAt || new Date(),
      metadata: props.metadata || {}
    };

    this.validate();
  }

  // Getters
  get id(): string { return this.props.id!; }
  get userId(): string { return this.props.userId; }
  get fromChain(): string { return this.props.fromChain; }
  get toChain(): string { return this.props.toChain; }
  get fromToken(): string { return this.props.fromToken; }
  get toToken(): string { return this.props.toToken; }
  get amount(): string { return this.props.amount; }
  get operationType(): string { return this.props.operationType; }
  get route(): QuoteRoute { return this.props.route; }
  get alternatives(): QuoteAlternative[] { return this.props.alternatives; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get createdAt(): Date { return this.props.createdAt!; }
  get metadata(): Record<string, any> { return this.props.metadata!; }

  // Business methods
  public isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  public getTimeToExpiry(): number {
    return Math.max(0, this.props.expiresAt.getTime() - Date.now());
  }

  public getBestAlternative(): QuoteAlternative | undefined {
    if (this.props.alternatives.length === 0) return undefined;

    return this.props.alternatives.reduce((best, current) => {
      const bestOutput = parseFloat(best.outputAmount);
      const currentOutput = parseFloat(current.outputAmount);
      return currentOutput > bestOutput ? current : best;
    });
  }

  public getFastestRoute(): QuoteAlternative | undefined {
    if (this.props.alternatives.length === 0) return undefined;

    return this.props.alternatives.reduce((fastest, current) => {
      return current.totalTime < fastest.totalTime ? current : fastest;
    });
  }

  public getCheapestRoute(): QuoteAlternative | undefined {
    if (this.props.alternatives.length === 0) return undefined;

    return this.props.alternatives.reduce((cheapest, current) => {
      const cheapestFees = parseFloat(cheapest.totalFees);
      const currentFees = parseFloat(current.totalFees);
      return currentFees < cheapestFees ? current : cheapest;
    });
  }

  public getRecommendedRoute(preferences: {
    prioritizeSpeed?: boolean;
    prioritizeCost?: boolean;
    minConfidence?: number;
  } = {}): QuoteAlternative | undefined {
    let filteredAlternatives = this.props.alternatives;

    // Filter by minimum confidence
    if (preferences.minConfidence) {
      filteredAlternatives = filteredAlternatives.filter(
        alt => alt.confidence >= preferences.minConfidence!
      );
    }

    if (filteredAlternatives.length === 0) return undefined;

    // Return based on preference
    if (preferences.prioritizeSpeed) {
      return filteredAlternatives.reduce((fastest, current) => {
        return current.totalTime < fastest.totalTime ? current : fastest;
      });
    }

    if (preferences.prioritizeCost) {
      return filteredAlternatives.reduce((cheapest, current) => {
        const cheapestFees = parseFloat(cheapest.totalFees);
        const currentFees = parseFloat(current.totalFees);
        return currentFees < cheapestFees ? current : cheapest;
      });
    }

    // Default: best output amount with good confidence
    return filteredAlternatives.reduce((best, current) => {
      const bestOutput = parseFloat(best.outputAmount);
      const currentOutput = parseFloat(current.outputAmount);

      // Prefer higher output, but consider confidence
      const bestScore = bestOutput * best.confidence;
      const currentScore = currentOutput * current.confidence;

      return currentScore > bestScore ? current : best;
    });
  }

  public getEstimatedSlippage(): number {
    const amount = parseFloat(this.props.amount);
    const outputAmount = parseFloat(this.props.route.minimumReceived);

    if (amount === 0) return 0;

    return ((amount - outputAmount) / amount) * 100;
  }

  public getTotalGasCost(): string {
    return this.props.route.totalFees.gasFees;
  }

  public getTotalBridgeCost(): string {
    return this.props.route.totalFees.bridgeFees;
  }

  public addMetadata(key: string, value: any): void {
    this.props.metadata![key] = value;
  }

  public toJSON(): CrossChainQuoteProps {
    return { ...this.props };
  }

  public toApiResponse(): {
    quoteId: string;
    route: QuoteRoute;
    alternatives: QuoteAlternative[];
    expiresAt: string;
    estimatedSlippage: number;
    recommendation?: QuoteAlternative;
  } {
    return {
      quoteId: this.id,
      route: this.route,
      alternatives: this.alternatives,
      expiresAt: this.expiresAt.toISOString(),
      estimatedSlippage: this.getEstimatedSlippage(),
      recommendation: this.getRecommendedRoute()
    };
  }

  private validate(): void {
    if (!this.props.userId) {
      throw new Error('CrossChainQuote: userId is required');
    }

    if (!this.props.fromChain || !this.props.toChain) {
      throw new Error('CrossChainQuote: fromChain and toChain are required');
    }

    if (!this.props.fromToken || !this.props.toToken) {
      throw new Error('CrossChainQuote: fromToken and toToken are required');
    }

    if (!this.props.amount) {
      throw new Error('CrossChainQuote: amount is required');
    }

    // Validate amount is positive number
    const amount = parseFloat(this.props.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('CrossChainQuote: amount must be a positive number');
    }

    if (!this.props.route) {
      throw new Error('CrossChainQuote: route is required');
    }

    if (!this.props.expiresAt) {
      throw new Error('CrossChainQuote: expiresAt is required');
    }

    // Validate expiry is in the future
    if (this.props.expiresAt <= new Date()) {
      throw new Error('CrossChainQuote: expiresAt must be in the future');
    }

    // Validate route structure
    if (!Array.isArray(this.props.route.steps) || this.props.route.steps.length === 0) {
      throw new Error('CrossChainQuote: route must have at least one step');
    }

    // Validate alternatives
    if (!Array.isArray(this.props.alternatives)) {
      throw new Error('CrossChainQuote: alternatives must be an array');
    }
  }
}