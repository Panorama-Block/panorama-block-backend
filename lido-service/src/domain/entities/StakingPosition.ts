export interface StakingPosition {
  id: string;
  userAddress: string;
  stakedAmount: string;
  stETHBalance: string;
  wstETHBalance: string;
  apy: number | null;
  timestamp: Date;
  status: 'active' | 'pending' | 'completed' | 'failed';
}

export interface StakingTransaction {
  id: string;
  userAddress: string;
  type: 'stake' | 'unstake' | 'unstake_approval' | 'claim_rewards' | 'withdrawal_claim';
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

export interface WithdrawalRequest {
  requestId: string; // uint256 as string
  amountOfStETHWei: string;
  amountOfSharesWei: string;
  owner: string;
  timestamp: number; // unix seconds (as returned by the contract)
  isFinalized: boolean;
  isClaimed: boolean;
}

export interface LidoProtocolInfo {
  totalStaked: string;
  currentAPY: number | null;
  lastUpdate: Date;
}
