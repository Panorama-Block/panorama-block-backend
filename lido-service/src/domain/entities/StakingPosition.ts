export interface StakingPosition {
  id: string;
  userAddress: string;
  stakedAmount: string;
  stETHBalance: string;
  wstETHBalance: string;
  rewards: string;
  apy: number;
  timestamp: Date;
  status: 'active' | 'pending' | 'completed' | 'failed';
}

export interface StakingTransaction {
  id: string;
  userAddress: string;
  type: 'stake' | 'unstake' | 'unstake_approval' | 'claim_rewards';
  amount: string;
  token: 'ETH' | 'stETH' | 'wstETH';
  transactionHash?: string;
  blockNumber?: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  gasUsed?: string;
  gasPrice?: string;
  transactionData?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
  // For multi-step transactions (like unstake which requires approval first)
  requiresFollowUp?: boolean;
  followUpAction?: 'unstake';
}

export interface LidoProtocolInfo {
  totalStaked: string;
  totalRewards: string;
  currentAPY: number;
  stETHPrice: string;
  wstETHPrice: string;
  lastUpdate: Date;
}
