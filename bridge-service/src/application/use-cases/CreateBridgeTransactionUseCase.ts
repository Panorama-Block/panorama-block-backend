import { BridgeProviderPort } from '../../domain/ports/BridgeProviderPort';
import { BridgeTransaction } from '../../domain/entities/BridgeTransaction';
import { BridgeQuote } from '../../domain/entities/BridgeQuote';

export class CreateBridgeTransactionUseCase {
    constructor(private readonly bridgeProvider: BridgeProviderPort) { }

    async execute(amount: number, destinationAddress: string, sourceNetwork: string, destinationNetwork: string, sourceAddress?: string, refuel?: boolean): Promise<{ transaction: BridgeTransaction; quote: BridgeQuote }> {
        // 1. Get Quote to validate limits
        const quote = await this.bridgeProvider.getQuote(amount, sourceNetwork, destinationNetwork, refuel);

        // 2. Validate if amount is sufficient
        if (amount <= quote.fee) {
            throw new Error(`Amount ${amount} is too low to cover fees (${quote.fee})`);
        }

        if (quote.estimatedReceiveAmount <= 0) {
            throw new Error('Estimated receive amount must be greater than 0');
        }

        // 3. Create Swap
        const transaction = await this.bridgeProvider.createSwap(amount, destinationAddress, sourceNetwork, destinationNetwork, sourceAddress, refuel);
        console.log("[UseCase] transaction: ", transaction)

        return {
            transaction,
            quote,
        };
    }
}
