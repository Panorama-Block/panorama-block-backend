// Domain Entities - Swap
export class SwapRequest {
  private readonly _fromChainId: number;
  private readonly _toChainId: number;
  private readonly _fromToken: string;
  private readonly _toToken: string;
  private readonly _amount: bigint;
  private readonly _sender: string;
  private readonly _receiver: string;

  constructor(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: bigint,
    sender: string,
    receiver: string
  ) {
    this.validateInputs(fromChainId, toChainId, fromToken, toToken, amount, sender, receiver);
    
    this._fromChainId = fromChainId;
    this._toChainId = toChainId;
    this._fromToken = fromToken;
    this._toToken = toToken;
    this._amount = amount;
    this._sender = sender;
    this._receiver = receiver;
  }

  private validateInputs(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: bigint,
    sender: string,
    receiver: string
  ): void {
    if (!fromChainId || fromChainId <= 0) {
      throw new Error("Invalid fromChainId");
    }
    if (!toChainId || toChainId <= 0) {
      throw new Error("Invalid toChainId");
    }
    if (!fromToken || fromToken.trim() === "") {
      throw new Error("Invalid fromToken");
    }
    if (!toToken || toToken.trim() === "") {
      throw new Error("Invalid toToken");
    }
    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
    if (!sender || sender.trim() === "") {
      throw new Error("Invalid sender address");
    }
    if (!receiver || receiver.trim() === "") {
      throw new Error("Invalid receiver address");
    }
  }

  get fromChainId(): number { return this._fromChainId; }
  get toChainId(): number { return this._toChainId; }
  get fromToken(): string { return this._fromToken; }
  get toToken(): string { return this._toToken; }
  get amount(): bigint { return this._amount; }
  get sender(): string { return this._sender; }
  get receiver(): string { return this._receiver; }

  public isNativeToken(): boolean {
    return this._fromToken.toLowerCase() === "native";
  }

  public toLogString(): string {
    return `Swap(${this._fromChainId} -> ${this._toChainId}, ${this._fromToken} -> ${this._toToken}, ${this._amount.toString()})`;
  }
}

export class SwapQuote {
  private readonly _estimatedReceiveAmount: bigint;
  private readonly _bridgeFee: bigint;
  private readonly _gasFee: bigint;
  private readonly _exchangeRate: number;
  private readonly _estimatedDuration: number; // in seconds

  constructor(
    estimatedReceiveAmount: bigint,
    bridgeFee: bigint,
    gasFee: bigint,
    exchangeRate: number,
    estimatedDuration: number
  ) {
    this._estimatedReceiveAmount = estimatedReceiveAmount;
    this._bridgeFee = bridgeFee;
    this._gasFee = gasFee;
    this._exchangeRate = exchangeRate;
    this._estimatedDuration = estimatedDuration;
  }

  get estimatedReceiveAmount(): bigint { return this._estimatedReceiveAmount; }
  get bridgeFee(): bigint { return this._bridgeFee; }
  get gasFee(): bigint { return this._gasFee; }
  get exchangeRate(): number { return this._exchangeRate; }
  get estimatedDuration(): number { return this._estimatedDuration; }

  public getTotalFees(): bigint {
    return this._bridgeFee + this._gasFee;
  }
}

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export class SwapTransaction {
  private readonly _hash: string;
  private readonly _chainId: number;
  private readonly _to: string;
  private readonly _data: string;
  private readonly _value: bigint;
  private _status: TransactionStatus;

  constructor(
    hash: string,
    chainId: number,
    to: string,
    data: string,
    value: bigint
  ) {
    this._hash = hash;
    this._chainId = chainId;
    this._to = to;
    this._data = data;
    this._value = value;
    this._status = TransactionStatus.PENDING;
  }

  get hash(): string { return this._hash; }
  get chainId(): number { return this._chainId; }
  get to(): string { return this._to; }
  get data(): string { return this._data; }
  get value(): bigint { return this._value; }
  get status(): TransactionStatus { return this._status; }

  public updateStatus(status: TransactionStatus): void {
    this._status = status;
  }

  public isCompleted(): boolean {
    return this._status === TransactionStatus.COMPLETED;
  }

  public isFailed(): boolean {
    return this._status === TransactionStatus.FAILED;
  }
}

export class SwapResult {
  private readonly _transactions: SwapTransaction[];
  private readonly _quote: SwapQuote;
  private readonly _startTime: Date;
  private _endTime?: Date;

  constructor(transactions: SwapTransaction[], quote: SwapQuote) {
    this._transactions = transactions;
    this._quote = quote;
    this._startTime = new Date();
  }

  get transactions(): SwapTransaction[] { return [...this._transactions]; }
  get quote(): SwapQuote { return this._quote; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date | undefined { return this._endTime; }

  public complete(): void {
    this._endTime = new Date();
  }

  public getDuration(): number | undefined {
    if (!this._endTime) return undefined;
    return this._endTime.getTime() - this._startTime.getTime();
  }

  public isCompleted(): boolean {
    return this._transactions.every(tx => tx.isCompleted());
  }

  public hasFailed(): boolean {
    return this._transactions.some(tx => tx.isFailed());
  }
} 