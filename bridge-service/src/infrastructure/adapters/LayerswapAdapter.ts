import axios, { AxiosInstance } from 'axios';
import { BridgeProviderPort } from '../../domain/ports/BridgeProviderPort';
import { BridgeQuote } from '../../domain/entities/BridgeQuote';
import { BridgeTransaction } from '../../domain/entities/BridgeTransaction';
import { stringify } from 'querystring';

export class LayerswapAdapter implements BridgeProviderPort {
    private readonly client: AxiosInstance;
    private readonly apiKey: string;
    private readonly apiUrl = 'https://api.layerswap.io/api/v2';
    private readonly tonVaultAddress: string;

    constructor() {
        this.apiKey = process.env.LAYERSWAP_API_KEY || '';
        if (!this.apiKey) {
            console.warn('LAYERSWAP_API_KEY is not set');
        }

        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'X-LS-APIKEY': this.apiKey,
                'Content-Type': 'application/json',
            },
        });

        this.tonVaultAddress = process.env.LAYERSWAP_TON_VAULT || '';
        if (!this.tonVaultAddress) {
            console.warn('LAYERSWAP_TON_VAULT is not set');
            throw new Error('LAYERSWAP_TON_VAULT is not set');
        }
    }

    async getQuote(amount: number, sourceNetwork: string, destinationNetwork: string, refuel?: boolean): Promise<BridgeQuote> {
        try {
            const params = {
                source_network: sourceNetwork,
                source_token: 'USDT',
                destination_network: destinationNetwork,
                destination_token: 'USDT',
                amount: amount,
                refuel: refuel,
            };
            console.log('[LayerswapAdapter] getQuote params:', params);

            const response = await this.client.get('/quote', { params });
            const data = response.data.data;

            // If the API returns the quote directly in data or data.data
            const quoteData = data?.quote || data;

            return new BridgeQuote(
                sourceNetwork,
                destinationNetwork,
                'USDT',
                'USDT',
                amount,
                quoteData?.receive_amount || 0, // Fallback or throw if missing
                quoteData?.fee || 0,
                data?.refuel?.amount,
                data?.refuel?.amount_in_usd
            );
        } catch (error) {
            console.error('Error getting quote from Layerswap:', error);
            throw new Error('Failed to get quote from Layerswap');
        }
    }

    async createSwap(amount: number, destinationAddress: string, sourceNetwork: string, destinationNetwork: string, sourceAddress?: string, refuel?: boolean): Promise<BridgeTransaction> {
        try {
            // 1. Confirm the Payload
            // Layerswap v2 requires source_address for better tracking, even if optional
            const payload = {
                source_network: sourceNetwork,
                source_token: 'USDT',
                destination_network: destinationNetwork,
                destination_token: 'USDT',
                amount: amount,
                destination_address: destinationAddress,
                source_address: sourceAddress, // <--- Pass the User's TON Wallet Address here if you have it
                refuel: refuel,
                use_deposit_address: destinationNetwork === 'TON_MAINNET'
            };

            const response = await this.client.post('/swaps', payload);
            const data = response.data.data;
            console.log("data: ", data);
            const swapData = data?.swap || data;
            const deposit_actions = data?.deposit_actions;
            console.log("deposit actions: ", deposit_actions);

            // 2. The Logic: "SwapID is the Key"
            // We use the ID as the Memo. We use our hardcoded address as destination.

            let transactionPayload: any = {
                depositActions: deposit_actions
            };

            let depositAddress = '';

            // Default to TON Vault ONLY if source is TON
            if (sourceNetwork === 'TON_MAINNET') {
                depositAddress = this.tonVaultAddress;
            }

            // Extract the specific comment (sequence number) required by Layerswap
            if (deposit_actions && Array.isArray(deposit_actions)) {
                const transferAction = deposit_actions.find((a: any) => a.type === 'transfer' || a.type === 'manual_transfer');
                if (transferAction) {
                    // Use the dynamic address from Layerswap if available
                    if (transferAction.to_address) {
                        depositAddress = transferAction.to_address;
                    }

                    if (transferAction.call_data) {
                        try {
                            const callData = typeof transferAction.call_data === 'string'
                                ? JSON.parse(transferAction.call_data)
                                : transferAction.call_data;

                            if (callData.comment) {
                                transactionPayload.comment = callData.comment;
                            }
                        } catch (e) {
                            console.warn('Failed to parse call_data from Layerswap:', e);
                        }
                    }
                }
            }

            if (!depositAddress) {
                throw new Error('Failed to determine deposit address from Layerswap response');
            }

            return new BridgeTransaction(
                swapData.id,        // <--- CRITICAL: This is the Memo
                depositAddress,     // <--- Dynamic Address from Layerswap
                String(swapData.requested_amount || amount),
                'PENDING',
                transactionPayload
            );
        } catch (error: any) {
            const body = error?.response?.data;
            console.error('Error creating swap on Layerswap:', body || error);
            throw new Error(
                body?.error?.message ||
                body?.message ||
                'Failed to create swap on Layerswap'
            );
        }
    }

    async getSwapStatus(swapId: string): Promise<any> {
        try {
            const response = await this.client.get(`/swaps/${swapId}`);
            const data = response.data?.data || response.data;
            const swapData = data?.swap || data;
            return swapData;
        } catch (error) {
            console.error('Error getting swap status from Layerswap:', error);
            throw new Error('Failed to get swap status from Layerswap');
        }
    }
}
