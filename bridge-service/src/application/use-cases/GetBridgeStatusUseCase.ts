import { BridgeProviderPort } from '../../domain/ports/BridgeProviderPort';

export class GetBridgeStatusUseCase {
    constructor(private readonly bridgeProvider: BridgeProviderPort) { }

    async execute(swapId: string): Promise<any> {
        if (!swapId || typeof swapId !== 'string') {
            throw new Error('swapId is required');
        }
        return this.bridgeProvider.getSwapStatus(swapId);
    }
}
