import { BridgeProviderPort } from '../../domain/ports/BridgeProviderPort';
import { BridgeQuote } from '../../domain/entities/BridgeQuote';

export class GetBridgeQuoteUseCase {
    constructor(private readonly bridgeProvider: BridgeProviderPort) { }

    async execute(amount: number, sourceNetwork: string, destinationNetwork: string, refuel?: boolean): Promise<BridgeQuote> {
        return this.bridgeProvider.getQuote(amount, sourceNetwork, destinationNetwork, refuel);
    }
}
