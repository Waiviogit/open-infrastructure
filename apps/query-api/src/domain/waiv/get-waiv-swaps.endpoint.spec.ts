import type { HiveEngineSwap } from '@opden-data-layer/odl-db-types';

import type { AccountsCurrentRepository, HiveEngineSwapsRepository } from '../../repositories';
import { GetWaivSwapsEndpoint } from './get-waiv-swaps.endpoint';
import { decodeWaivSwapsCursor, encodeWaivSwapsCursor } from './waiv-swaps-cursor';
import { InvalidWaivSwapsCursorError } from './waiv.errors';

function swapRow(id: number, account: string, seconds: number): HiveEngineSwap {
  return {
    id: String(id) as never,
    account,
    transaction_id: `tx-${id}`,
    block_number: 64_941_000 + id,
    ref_hive_block_number: 112_023_000 + id,
    block_timestamp: new Date(seconds * 1000),
    symbol_in: 'WAIV',
    symbol_in_quantity: '10.00000000',
    symbol_out: 'SWAP.HIVE',
    symbol_out_quantity: '1.80000000',
    symbols: ['WAIV', 'SWAP.HIVE'],
    created_at: new Date(seconds * 1000),
  };
}

function setup(rows: HiveEngineSwap[]) {
  const swaps = { findWaivPoolSwaps: jest.fn().mockResolvedValue(rows) };
  const accounts = {
    findByNames: jest.fn().mockResolvedValue([]),
  };
  const endpoint = new GetWaivSwapsEndpoint(
    swaps as unknown as HiveEngineSwapsRepository,
    accounts as unknown as AccountsCurrentRepository,
  );
  return { endpoint, swaps };
}

describe('GetWaivSwapsEndpoint', () => {
  it('asks for one extra row and returns a cursor at the last row of the page', async () => {
    const { endpoint, swaps } = setup([
      swapRow(3, 'alice', 1_795_766_300),
      swapRow(2, 'bob', 1_795_766_200),
      swapRow(1, 'carol', 1_795_766_100),
    ]);

    const page = await endpoint.execute({ limit: 2 });

    expect(swaps.findWaivPoolSwaps).toHaveBeenCalledWith(3, null);
    expect(page.items.map((item) => item.id)).toEqual(['3', '2']);
    expect(page.hasMore).toBe(true);
    expect(decodeWaivSwapsCursor(page.cursor ?? '')).toEqual({
      blockTimestamp: new Date(1_795_766_200 * 1000),
      id: '2',
    });
    expect(page.items[0]).toMatchObject({
      account: 'alice',
      avatarUrl: null,
      transactionId: 'tx-3',
      timestamp: new Date(1_795_766_300 * 1000).toISOString(),
      symbolIn: 'WAIV',
      symbolOutQuantity: '1.80000000',
    });
  });

  it('ends the feed without a cursor', async () => {
    const { endpoint } = setup([swapRow(1, 'carol', 1_795_766_100)]);
    const page = await endpoint.execute({ limit: 20 });
    expect(page).toMatchObject({ hasMore: false, cursor: null });
  });

  it('passes a decoded cursor as the keyset', async () => {
    const { endpoint, swaps } = setup([]);
    const cursor = encodeWaivSwapsCursor({
      blockTimestamp: new Date('2026-11-27T10:00:00.000Z'),
      id: '42',
    });
    await endpoint.execute({ limit: 5, cursor });
    expect(swaps.findWaivPoolSwaps).toHaveBeenCalledWith(6, {
      blockTimestamp: new Date('2026-11-27T10:00:00.000Z'),
      id: '42',
    });
  });

  it('rejects a cursor it did not issue', async () => {
    const { endpoint } = setup([]);
    await expect(endpoint.execute({ limit: 5, cursor: 'bm90LWEtY3Vyc29y' })).rejects.toBeInstanceOf(
      InvalidWaivSwapsCursorError,
    );
  });
});

describe('waiv swaps cursor', () => {
  it('rejects a non-numeric id', () => {
    const raw = Buffer.from(JSON.stringify({ t: '2026-11-27T10:00:00.000Z', id: '1 OR 1=1' })).toString(
      'base64url',
    );
    expect(decodeWaivSwapsCursor(raw)).toBeNull();
  });
});
