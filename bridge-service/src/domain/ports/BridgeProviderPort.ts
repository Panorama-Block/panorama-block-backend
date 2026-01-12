import { BridgeQuote } from '../entities/BridgeQuote';
import { BridgeTransaction } from '../entities/BridgeTransaction';

export interface BridgeProviderPort {
    getQuote(amount: number, sourceNetwork: string, destinationNetwork: string, refuel?: boolean): Promise<BridgeQuote>;
    createSwap(amount: number, destinationAddress: string, sourceNetwork: string, destinationNetwork: string, sourceAddress?: string, refuel?: boolean): Promise<BridgeTransaction>;
    getSwapStatus(swapId: string): Promise<any>;
}
