import type { Transaction } from "../../domain/ports/swap.provider.port";

export type SanitizedTransactions = {
  executable: Transaction[];
  discarded: Transaction[];
};

/**
 * Separate prepared transactions into those that can be executed on the origin chain
 * and those that must be discarded (e.g., destination chain settlement steps).
 */
export function sanitizePreparedTransactions(
  transactions: Transaction[],
  originChainId: number
): SanitizedTransactions {
  const executable: Transaction[] = [];
  const discarded: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.chainId === originChainId) {
      executable.push(tx);
    } else {
      discarded.push(tx);
    }
  }

  return { executable, discarded };
}
