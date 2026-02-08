export interface PortfolioAsset {
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  balanceWei: string;
  updatedAt: Date;
}

export interface PortfolioMetricDaily {
  chainId: number;
  date: string; // YYYY-MM-DD
  stethBalanceWei: string;
  wstethBalanceWei: string;
  totalStakedWei: string;
  apyBps: number | null;
  updatedAt: Date;
}

