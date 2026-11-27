import { toSegments } from './segments';
import { swapRate, swapSide } from './swap-view';
import type { WaivSwap } from './waiv-token.types';

function swap(partial: Partial<WaivSwap>): WaivSwap {
  return {
    id: '1',
    account: 'alice',
    avatarUrl: null,
    transactionId: 'tx',
    blockNumber: 1,
    timestamp: '2026-11-27T10:00:00.000Z',
    symbolIn: 'WAIV',
    symbolInQuantity: '10',
    symbolOut: 'SWAP.HIVE',
    symbolOutQuantity: '1.8',
    ...partial,
  };
}

describe('swapSide / swapRate', () => {
  it('paying WAIV is a sell; the rate is received per paid', () => {
    const sell = swap({});
    expect(swapSide(sell)).toBe('sell');
    expect(swapRate(sell)).toEqual({ rate: '0.18000000', quote: 'SWAP.HIVE', base: 'WAIV' });
  });

  it('receiving WAIV is a buy; the rate is WAIV per SWAP.HIVE', () => {
    const buy = swap({
      symbolIn: 'SWAP.HIVE',
      symbolInQuantity: '2',
      symbolOut: 'WAIV',
      symbolOutQuantity: '10',
    });
    expect(swapSide(buy)).toBe('buy');
    expect(swapRate(buy)).toEqual({ rate: '5.00000000', quote: 'WAIV', base: 'SWAP.HIVE' });
  });

  it('has no price for zero or broken quantities', () => {
    expect(swapRate(swap({ symbolOutQuantity: '0' }))).toBeNull();
    expect(swapRate(swap({ symbolInQuantity: 'n/a' }))).toBeNull();
  });
});

describe('toSegments', () => {
  it('computes shares and drops empty parts', () => {
    expect(
      toSegments([
        { id: 'a', value: 3 },
        { id: 'b', value: 1 },
        { id: 'c', value: 0 },
      ]),
    ).toEqual([
      { id: 'a', value: 3, share: 75 },
      { id: 'b', value: 1, share: 25 },
    ]);
  });

  it('returns nothing for an empty whole', () => {
    expect(toSegments([{ id: 'a', value: 0 }])).toEqual([]);
  });
});
