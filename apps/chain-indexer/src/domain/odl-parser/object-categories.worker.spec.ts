import { UPDATE_TYPES } from '@opden-data-layer/core';
import type { ObjectCategoriesSyncQueueRow } from '@opden-data-layer/odl-db-types';
import { ObjectCategoriesWorker } from './object-categories.worker';
import { UserCategoryScopeEnqueueService } from './user-category-scope-enqueue.service';

const TRX = { kind: 'trx' };

function task(overrides: Partial<ObjectCategoriesSyncQueueRow> = {}): ObjectCategoriesSyncQueueRow {
  return { object_id: 'o1', enqueued_at: 100, attempts: 1, last_attempt_at: 200, ...overrides };
}

function setup(opts: {
  objectType: string;
  previousNames: string[] | null;
  previousMetaGroupId?: string | null;
  metaGroupId?: string | null;
  resolvedNames: string[];
  favoriters?: string[];
  postAuthors?: string[];
}) {
  const objectQueue = {
    claimBatch: jest.fn().mockResolvedValue([task()]),
    deleteClaimed: jest.fn().mockResolvedValue(true),
    resetAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const relatedQueue = {
    enqueue: jest.fn().mockResolvedValue(undefined),
    enqueueMany: jest.fn().mockResolvedValue(undefined),
  };
  const categories = {
    findByObjectId: jest
      .fn()
      .mockResolvedValue(
        opts.previousNames === null
          ? undefined
          : {
              category_names: opts.previousNames,
              meta_group_id: opts.previousMetaGroupId ?? null,
            },
      ),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const aggregated = {
    core: { object_id: 'o1', object_type: opts.objectType, meta_group_id: opts.metaGroupId ?? null },
    updates: [],
  };
  const viewService = {
    resolve: jest.fn().mockReturnValue([
      {
        fields: {
          [UPDATE_TYPES.CATEGORY]: {
            values: opts.resolvedNames.map((name, i) => ({
              value_text: name,
              event_seq: BigInt(i + 1),
            })),
          },
        },
      },
    ]),
  };
  const scopes = new UserCategoryScopeEnqueueService(
    relatedQueue as never,
    {
      findByObjectId: jest
        .fn()
        .mockResolvedValue((opts.favoriters ?? []).map((account) => ({ account }))),
    } as never,
    {
      findDistinctAuthorsByLinkedObject: jest.fn().mockResolvedValue(opts.postAuthors ?? []),
    } as never,
  );
  const db = {
    transaction: () => ({
      execute: (fn: (trx: unknown) => Promise<void>) => fn(TRX),
    }),
  };
  const worker = new ObjectCategoriesWorker(
    { get: jest.fn((_key: string, fallback: number) => fallback) } as never,
    {} as never,
    objectQueue as never,
    {
      loadByObjectIds: jest
        .fn()
        .mockResolvedValue({ objects: [aggregated], voterWaivPowers: new Map() }),
    } as never,
    { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
    viewService as never,
    categories as never,
    relatedQueue as never,
    scopes,
    db as never,
  );
  return { worker, objectQueue, relatedQueue, categories };
}

describe('ObjectCategoriesWorker', () => {
  it('after a category change enqueues global + (account, type) of favoriters and post authors with the upsert', async () => {
    const { worker, relatedQueue, categories } = setup({
      objectType: 'recipe',
      previousNames: ['Soups'],
      resolvedNames: ['Soups', 'Comfort Food'],
      favoriters: ['fan'],
      postAuthors: ['writer', 'fan'],
    });

    await worker.runBatch();

    expect(categories.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ object_id: 'o1', category_names: ['Soups', 'Comfort Food'] }),
      TRX,
    );
    expect(relatedQueue.enqueue).toHaveBeenCalledWith('global', '_', expect.any(Number), TRX);
    expect(relatedQueue.enqueueMany).toHaveBeenCalledWith(
      'user',
      ['fan:recipe', 'writer:recipe'],
      expect.any(Number),
      TRX,
    );
  });

  it('enqueues the first categories of an object that had no row', async () => {
    const { worker, relatedQueue } = setup({
      objectType: 'book',
      previousNames: null,
      resolvedNames: ['Fiction'],
      favoriters: ['fan'],
    });

    await worker.runBatch();

    expect(relatedQueue.enqueueMany).toHaveBeenCalledWith(
      'user',
      ['fan:book'],
      expect.any(Number),
      TRX,
    );
  });

  it.each([
    ['identical names', ['A', 'B'], ['A', 'B']],
    ['same names in another order', ['B', 'A'], ['A', 'B']],
  ])('does not enqueue any scope for %s', async (_label, previousNames, resolvedNames) => {
    const { worker, relatedQueue, categories } = setup({
      objectType: 'recipe',
      previousNames,
      resolvedNames,
      favoriters: ['fan'],
    });

    await worker.runBatch();

    expect(categories.upsert).toHaveBeenCalledTimes(1);
    expect(relatedQueue.enqueue).not.toHaveBeenCalled();
    expect(relatedQueue.enqueueMany).not.toHaveBeenCalled();
  });

  it('enqueues the scopes when only the meta group changed (scopes group by it)', async () => {
    const { worker, relatedQueue } = setup({
      objectType: 'product',
      previousNames: ['A'],
      resolvedNames: ['A'],
      previousMetaGroupId: null,
      metaGroupId: 'g1',
      favoriters: ['fan'],
    });

    await worker.runBatch();

    expect(relatedQueue.enqueue).toHaveBeenCalledWith('global', '_', expect.any(Number), TRX);
    expect(relatedQueue.enqueueMany).toHaveBeenCalledWith(
      'user',
      ['fan:product'],
      expect.any(Number),
      TRX,
    );
  });

  it('does not enqueue anything for an uncategorized object without a previous row', async () => {
    const { worker, relatedQueue } = setup({
      objectType: 'recipe',
      previousNames: null,
      resolvedNames: [],
      favoriters: ['fan'],
    });

    await worker.runBatch();

    expect(relatedQueue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues only the global scope when a non-category type changes categories', async () => {
    const { worker, relatedQueue } = setup({
      objectType: 'place',
      previousNames: [],
      resolvedNames: ['Cafe'],
      favoriters: ['fan'],
    });

    await worker.runBatch();

    expect(relatedQueue.enqueue).toHaveBeenCalledWith('global', '_', expect.any(Number), TRX);
    const userKeys = relatedQueue.enqueueMany.mock.calls.flatMap(([, keys]) => keys as string[]);
    expect(userKeys).toEqual([]);
  });

  it('releases the queue row when the object was re-enqueued during processing', async () => {
    const { worker, objectQueue } = setup({
      objectType: 'recipe',
      previousNames: ['A'],
      resolvedNames: ['A'],
    });
    objectQueue.deleteClaimed.mockResolvedValue(false);

    await worker.runBatch();

    expect(objectQueue.deleteClaimed).toHaveBeenCalledWith('o1', 100);
    expect(objectQueue.resetAttempt).toHaveBeenCalledWith('o1');
  });

  it('retries the task when the scope enqueue fails, so the change is not lost', async () => {
    const { worker, objectQueue, relatedQueue } = setup({
      objectType: 'recipe',
      previousNames: ['A'],
      resolvedNames: ['B'],
      favoriters: ['fan'],
    });
    relatedQueue.enqueueMany.mockRejectedValue(new Error('db down'));

    await worker.runBatch();

    expect(objectQueue.deleteClaimed).not.toHaveBeenCalled();
    expect(objectQueue.resetAttempt).toHaveBeenCalledWith('o1');
  });
});
