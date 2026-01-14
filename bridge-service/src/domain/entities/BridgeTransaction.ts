export class BridgeTransaction {
    constructor(
        public readonly swapId: string,
        public readonly depositAddress: string,
        public readonly amount: string,
        public readonly status: string,
        public readonly transactionPayload?: any
    ) { }
}
