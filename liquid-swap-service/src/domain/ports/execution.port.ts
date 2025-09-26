// Domain Port for server-side execution via Engine (ERC-4337 session key)

export type ExecutionOptions = {
  type: "ERC4337";
  smartAccountAddress: string;
  signerAddress: string; // session key address authorized for the smart account
};

export type PreparedOriginTx = {
  chainId: number;
  to: string;
  data: string;
  value?: string; // wei as string
};

export type ExecutionResult = {
  transactionHash: string;
  chainId: number;
  userOpHash?: string;
};

export interface IExecutionPort {
  executeOriginTxs(
    txs: PreparedOriginTx[],
    options: ExecutionOptions,
    meta: { sender: string }
  ): Promise<ExecutionResult[]>;
}

