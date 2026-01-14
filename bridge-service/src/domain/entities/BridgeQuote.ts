export class BridgeQuote {
    constructor(
        public readonly sourceNetwork: string,
        public readonly destinationNetwork: string,
        public readonly sourceToken: string,
        public readonly destinationToken: string,
        public readonly amount: number,
        public readonly estimatedReceiveAmount: number,
        public readonly fee: number,
        public readonly refuelAmount?: number,
        public readonly refuelAmountInUsd?: number
    ) { }
}
