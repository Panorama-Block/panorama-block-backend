// Lido Protocol Contract Addresses and ABIs

export const LIDO_CONTRACTS = {
  // Mainnet addresses
  STETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  WSTETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  REWARDS: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
  WITHDRAWAL_QUEUE: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
  DEPOSIT_SECURITY_MODULE: '0x710B3303fB508a4F9f481E4755E5a47675Ef4E1D'
};

// stETH ABI - Essential functions for staking
export const STETH_ABI = [
  'function submit() payable returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getTotalPooledEther() view returns (uint256)',
  'function getTotalShares() view returns (uint256)',
  'function getPooledEthByShares(uint256) view returns (uint256)',
  'function getSharesByPooledEth(uint256) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Submitted(address indexed sender, uint256 amount, address referral)'
];

// wstETH ABI - Wrapped stETH functions
export const WSTETH_ABI = [
  'function wrap(uint256) returns (uint256)',
  'function unwrap(uint256) returns (uint256)',
  'function getWstETHByStETH(uint256) view returns (uint256)',
  'function getStETHByWstETH(uint256) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event WstETH(address indexed dst, uint256 wstETHAmount)',
  'event UnwstETH(address indexed dst, uint256 wstETHAmount)'
];

// Withdrawal Queue ABI
export const WITHDRAWAL_QUEUE_ABI = [
  'function requestWithdrawals(uint256[] amounts, address owner) returns (uint256)',
  'function getWithdrawalStatus(uint256[] requestIds) view returns (uint256[] statuses)',
  'function getWithdrawalRequests(address owner) view returns (uint256[] requestIds)',
  'function claimWithdrawals(uint256[] requestIds, uint256[] hints)',
  'function getLastFinalizedRequestId() view returns (uint256)',
  'function getLastCheckpointIndex() view returns (uint256)',
  'function findCheckpointHints(uint256[] requestIds, uint256 firstIndex, uint256 lastIndex) view returns (uint256[] hints)'
];
