import axios, { AxiosInstance } from 'axios';

export type SwapQuoteRequest = {
  fromChain?: string;
  toChain?: string;
  fromChainId?: number;
  toChainId?: number;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
  smartAccountAddress?: string;
};

export type SwapPrepareResponse = {
  txData: any;
  estimatedOutput: string;
  route: any;
};

export class LiquidSwapClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 10000
    });
  }

  async getQuote(request: SwapQuoteRequest) {
    const res = await this.http.post('/swap/quote', request);
    return res.data;
  }

  async prepareSwap(request: SwapQuoteRequest & { sender?: string; recipient?: string }): Promise<SwapPrepareResponse> {
    const res = await this.http.post('/swap/prepare', request);
    return res.data;
  }
}
