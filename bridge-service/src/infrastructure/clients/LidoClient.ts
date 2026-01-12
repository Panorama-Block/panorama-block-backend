import axios, { AxiosInstance } from 'axios';

export class LidoClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 10000
    });
  }

  async stake(amount: string, token: string = 'ETH') {
    const res = await this.http.post('/lido/stake', { amount, token });
    return res.data;
  }
}
