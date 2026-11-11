import type { ObjectCategoriesRelatedSyncQueueRow } from '@opden-data-layer/odl-db-types';
import { ObjectCategoriesRelatedWorker } from './object-categories-related.worker';

const MAX_ATTEMPTS = 3;

type Flags = {
  hide_linked_objects: boolean;
  hide_recipe_objects: boolean;
  hide_favorite_objects: boolean;
};

const NO_HIDE: Flags = {
  hide_linked_objects: false,
  hide_recipe_objects: false,
  hide_favorite_objects: false,
};

function task(
  scopeKey: string,
  overrides: Partial<ObjectCategoriesRelatedSyncQueueRow> = {},
): ObjectCategoriesRelatedSyncQueueRow {
  return {
    scope_type: 'user',
    scope_key: scopeKey,
    enqueued_at: 100,
    attempts: 1,
    last_attempt_at: 200,
    ...overrides,
  };
}

function setup(opts: { tasks: ObjectCategoriesRelatedSyncQueueRow[]; flags?: Flags | undefined }) {
  const queue = {
    claimBatch: jest.fn().mockResolvedValue(opts.tasks),
    deleteClaimed: jest.fn().mockResolvedValue(true),
    resetAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const related = {
    replaceGlobalScope: jest.fn().mockResolvedValue(undefined),
    replaceUserCategoryScope: jest.fn().mockResolvedValue(undefined),
    deleteUserScope: jest.fn().mockResolvedValue(undefined),
  };
  const userMetadata = { findByAccount: jest.fn().mockResolvedValue(opts.flags) };
  const deselect = { findObjectIdsByAccount: jest.fn().mockResolvedValue(['gone']) };
  const config = {
    get: jest.fn((key: string, fallback: number) =>
      key === 'objectCategoriesRelated.maxAttempts' ? MAX_ATTEMPTS : fallback,
    ),
  };
  const worker = new ObjectCategoriesRelatedWorker(
    config as never,
    {} as never,
    queue as never,
    related as never,
    userMetadata as never,
    deselect as never,
  );
  return { worker, queue, related, userMetadata };
}

describe('ObjectCategoriesRelatedWorker', () => {
  describe('per-type user scope', () => {
    it('rebuilds account:type with the deselected ids and drops the queue row', async () => {
      const { worker, queue, related } = setup({ tasks: [task('alice:recipe')], flags: NO_HIDE });

      await worker.runBatch();

      expect(related.replaceUserCategoryScope).toHaveBeenCalledWith('alice:recipe', {
        account: 'alice',
        objectType: 'recipe',
        includePostObjects: true,
        deselectIds: ['gone'],
      });
      expect(queue.deleteClaimed).toHaveBeenCalledWith('user', 'alice:recipe', 100);
      expect(queue.resetAttempt).not.toHaveBeenCalled();
    });

    it.each([
      ['book', { ...NO_HIDE, hide_linked_objects: true }, false],
      ['product', { ...NO_HIDE, hide_linked_objects: true }, false],
      ['recipe', { ...NO_HIDE, hide_linked_objects: true }, true],
      ['recipe', { ...NO_HIDE, hide_recipe_objects: true }, false],
      ['service', { ...NO_HIDE, hide_favorite_objects: true }, false],
      ['service', { ...NO_HIDE, hide_recipe_objects: true }, true],
    ])(
      'type %s with flags %j → includePostObjects %s',
      async (objectType, flags, expected) => {
        const { worker, related } = setup({ tasks: [task(`alice:${objectType}`)], flags });

        await worker.runBatch();

        expect(related.replaceUserCategoryScope).toHaveBeenCalledWith(
          `alice:${objectType}`,
          expect.objectContaining({ objectType, includePostObjects: expected }),
        );
      },
    );

    it('includes post-linked objects when the account has no user_metadata row', async () => {
      const { worker, related } = setup({ tasks: [task('alice:book')], flags: undefined });

      await worker.runBatch();

      expect(related.replaceUserCategoryScope).toHaveBeenCalledWith(
        'alice:book',
        expect.objectContaining({ includePostObjects: true }),
      );
    });
  });

  describe('legacy or invalid user scope keys', () => {
    it.each(['alice', 'alice:book,product', 'alice:place', ':recipe'])(
      'deletes the rows of %s, does not rebuild it and drops the task',
      async (scopeKey) => {
        const { worker, queue, related, userMetadata } = setup({ tasks: [task(scopeKey)] });

        await worker.runBatch();

        expect(related.deleteUserScope).toHaveBeenCalledWith(scopeKey);
        expect(related.replaceUserCategoryScope).not.toHaveBeenCalled();
        expect(userMetadata.findByAccount).not.toHaveBeenCalled();
        expect(queue.deleteClaimed).toHaveBeenCalledWith('user', scopeKey, 100);
      },
    );
  });

  it('rebuilds the global scope', async () => {
    const { worker, queue, related } = setup({
      tasks: [task('_', { scope_type: 'global' })],
    });

    await worker.runBatch();

    expect(related.replaceGlobalScope).toHaveBeenCalledTimes(1);
    expect(related.replaceUserCategoryScope).not.toHaveBeenCalled();
    expect(queue.deleteClaimed).toHaveBeenCalledWith('global', '_', 100);
  });

  describe('queue race and retries', () => {
    it('releases the row instead of losing it when the scope was re-enqueued during processing', async () => {
      const { worker, queue } = setup({ tasks: [task('alice:recipe')], flags: NO_HIDE });
      queue.deleteClaimed.mockResolvedValue(false);

      await worker.runBatch();

      expect(queue.resetAttempt).toHaveBeenCalledWith('user', 'alice:recipe');
    });

    it('keeps the row for retry when the rebuild fails below max attempts', async () => {
      const { worker, queue, related } = setup({ tasks: [task('alice:recipe')], flags: NO_HIDE });
      related.replaceUserCategoryScope.mockRejectedValue(new Error('boom'));

      await worker.runBatch();

      expect(queue.deleteClaimed).not.toHaveBeenCalled();
      expect(queue.resetAttempt).toHaveBeenCalledWith('user', 'alice:recipe');
    });

    it('drops the row after max attempts unless it was re-enqueued', async () => {
      const { worker, queue, related } = setup({
        tasks: [task('alice:recipe', { attempts: MAX_ATTEMPTS })],
        flags: NO_HIDE,
      });
      related.replaceUserCategoryScope.mockRejectedValue(new Error('boom'));

      await worker.runBatch();

      expect(queue.deleteClaimed).toHaveBeenCalledWith('user', 'alice:recipe', 100);
      expect(queue.resetAttempt).not.toHaveBeenCalled();
    });
  });
});
