export interface BalanceSyncOptions {
  force?: boolean;
  chains?: string[];
  protocols?: string[];
}

export interface BalanceSyncResult {
  synced: number;
  failed: number;
  scheduled?: boolean;
}

export interface IBalanceSyncService {
  start(): Promise<void>;
  stop(): Promise<void>;
  syncUserBalances(userId: string, options?: BalanceSyncOptions): Promise<BalanceSyncResult>;
  syncAllBalances(options?: BalanceSyncOptions): Promise<BalanceSyncResult>;
}
