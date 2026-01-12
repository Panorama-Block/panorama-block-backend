import axios, { AxiosInstance } from 'axios';

export type LendingActionRequest = {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  token: string;
  amount: string;
  chainId?: number;
};

export class LendingClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 10000
    });
  }

  async getMarkets() {
    const res = await this.http.get('/lending/markets');
    return res.data;
  }

  async act(request: LendingActionRequest) {
    const res = await this.http.post('/lending/act', request);
    return res.data;
  }
}
