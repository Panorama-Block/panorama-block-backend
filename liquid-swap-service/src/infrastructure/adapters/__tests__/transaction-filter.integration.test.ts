import { describe, expect, it } from '@jest/globals';
import { sanitizePreparedTransactions } from '../transaction-filter';

describe('sanitizePreparedTransactions (integration)', () => {
  it('returns only transactions that match the origin chain', () => {
    const prepared = [
      { chainId: 1, to: '0x1', data: '0x', value: '0' },
      { chainId: 42161, to: '0x2', data: '0x', value: '0' },
      { chainId: 1, to: '0x3', data: '0x', value: '0' },
    ];

    const { executable, discarded } = sanitizePreparedTransactions(prepared as any, 1);

    expect(executable).toHaveLength(2);
    expect(executable.every((tx) => tx.chainId === 1)).toBe(true);
    expect(discarded).toHaveLength(1);
    expect(discarded[0].chainId).toBe(42161);
  });
});
