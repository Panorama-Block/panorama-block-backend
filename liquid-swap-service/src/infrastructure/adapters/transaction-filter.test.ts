import { describe, expect, it } from "@jest/globals";
import type { Transaction } from "../../domain/ports/swap.provider.port";
import { sanitizePreparedTransactions } from "./transaction-filter";

describe("sanitizePreparedTransactions", () => {
  const baseTx = (overrides: Partial<Transaction>): Transaction => ({
    chainId: 1,
    to: "0x0000000000000000000000000000000000000001",
    data: "0x",
    value: "0",
    ...overrides,
  });

  it("keeps transactions for the origin chain", () => {
    const { executable, discarded } = sanitizePreparedTransactions(
      [
        baseTx({ chainId: 1, description: "swap" }),
        baseTx({ chainId: 1, description: "approval" }),
      ],
      1
    );

    expect(executable).toHaveLength(2);
    expect(discarded).toHaveLength(0);
  });

  it("discards transactions for other chains", () => {
    const { executable, discarded } = sanitizePreparedTransactions(
      [
        baseTx({ chainId: 1, description: "swap" }),
        baseTx({ chainId: 42161, description: "destination claim" }),
      ],
      1
    );

    expect(executable).toHaveLength(1);
    expect(executable[0].chainId).toBe(1);
    expect(discarded).toHaveLength(1);
    expect(discarded[0].chainId).toBe(42161);
  });

  it("handles empty transaction arrays", () => {
    const { executable, discarded } = sanitizePreparedTransactions([], 1);
    expect(executable).toHaveLength(0);
    expect(discarded).toHaveLength(0);
  });
});
