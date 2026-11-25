import { UPDATE_TYPES } from '@opden-data-layer/core';

import { CATEGORY_MUTATED_EVENT, CategoryMutatedEvent } from '../category-mutated.event';
import { GroupIdMutatedEvent } from '../group-id-mutated.event';
import { MetaGroupSyncHandler } from './meta-group-sync.handler';

const TRX = { kind: 'trx' };

function setup(opts: { currentGroupId: string | null; winningGroupId: string | null }) {
  let inTransaction = false;
  const calls: { name: string; inTransaction: boolean; trx: unknown }[] = [];
  const db = {
    transaction: () => ({
      execute: async (fn: (trx: unknown) => Promise<void>) => {
        inTransaction = true;
        try {
          await fn(TRX);
        } finally {
          inTransaction = false;
        }
      },
    }),
  };
  const objectsCoreRepository = {
    update: jest.fn(async (_id: string, _row: unknown, trx?: unknown) => {
      calls.push({ name: 'update', inTransaction, trx });
    }),
  };
  const searchQueue = {
    enqueue: jest.fn(async (_id: string, _at: number, trx?: unknown) => {
      calls.push({ name: 'enqueue', inTransaction, trx });
    }),
  };
  const emit = jest.fn();
  const viewService = {
    resolve: jest.fn().mockReturnValue([
      {
        fields: {
          [UPDATE_TYPES.PRODUCT_GROUP_ID]: {
            values:
              opts.winningGroupId === null ? [] : [{ value_text: opts.winningGroupId }],
          },
        },
      },
    ]),
  };
  const handler = new MetaGroupSyncHandler(
    {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [{ core: { object_id: 'o1', meta_group_id: opts.currentGroupId } }],
        voterWaivPowers: new Map(),
      }),
    } as never,
    viewService as never,
    { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
    objectsCoreRepository as never,
    { emit } as never,
    searchQueue as never,
    db as never,
  );
  return { handler, objectsCoreRepository, searchQueue, emit, calls };
}

describe('MetaGroupSyncHandler', () => {
  it('writes meta_group_id and enqueues the search document in one transaction', async () => {
    const { handler, objectsCoreRepository, searchQueue, emit, calls } = setup({
      currentGroupId: null,
      winningGroupId: 'g1',
    });

    await handler.handleGroupIdMutated(new GroupIdMutatedEvent('o1'));

    expect(objectsCoreRepository.update).toHaveBeenCalledWith('o1', { meta_group_id: 'g1' }, TRX);
    expect(searchQueue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number), TRX);
    expect(calls).toEqual([
      { name: 'update', inTransaction: true, trx: TRX },
      { name: 'enqueue', inTransaction: true, trx: TRX },
    ]);
    expect(emit).toHaveBeenCalledWith(CATEGORY_MUTATED_EVENT, new CategoryMutatedEvent('o1'));
  });

  it('does nothing when the winning group id is unchanged', async () => {
    const { handler, objectsCoreRepository, searchQueue, emit } = setup({
      currentGroupId: 'g1',
      winningGroupId: 'g1',
    });

    await handler.handleGroupIdMutated(new GroupIdMutatedEvent('o1'));

    expect(objectsCoreRepository.update).not.toHaveBeenCalled();
    expect(searchQueue.enqueue).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits no category event when the transaction fails', async () => {
    const { handler, searchQueue, emit } = setup({ currentGroupId: 'g1', winningGroupId: null });
    searchQueue.enqueue.mockRejectedValueOnce(new Error('queue down'));

    await handler.handleGroupIdMutated(new GroupIdMutatedEvent('o1'));

    expect(emit).not.toHaveBeenCalled();
  });
});
