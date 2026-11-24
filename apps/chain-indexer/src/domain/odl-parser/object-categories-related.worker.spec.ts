import type { ObjectCategoriesRelatedSyncQueueRow } from '@opden-data-layer/odl-db-types';
import { ObjectCategoriesRelatedWorker } from './object-categories-related.worker';

const MAX_ATTEMPTS = 3;

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

function setup(opts: { tasks: ObjectCategoriesRelatedSyncQueueRow[]; throttled?: string[] }) {
  const queue = {
    claimBatch: jest.fn().mockResolvedValue(opts.tasks),
    deleteClaimed: jest.fn().mockResolvedValue(true),
    resetAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const rebuild = {
    rebuildGlobalScope: jest.fn().mockResolvedValue('rebuilt'),
    rebuildUserScope: jest.fn().mockResolvedValue('rebuilt'),
    rebuildTypeScope: jest.fn().mockResolvedValue('rebuilt'),
  };
  const throttle = {
    throttledTypes: jest.fn().mockResolvedValue(opts.throttled ?? []),
    markRebuilt: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string, fallback: number) =>
      key === 'objectCategoriesRelated.maxAttempts' ? MAX_ATTEMPTS : fallback,
    ),
  };
  const worker = new ObjectCategoriesRelatedWorker(
    config as never,
    {} as never,
    queue as never,
    rebuild as never,
    throttle as never,
  );
  return { worker, queue, rebuild, throttle };
}

describe('ObjectCategoriesRelatedWorker', () => {
  it('rebuilds a user scope and drops the queue row', async () => {
    const { worker, queue, rebuild } = setup({ tasks: [task('alice:recipe')] });

    await worker.runBatch();

    expect(rebuild.rebuildUserScope).toHaveBeenCalledWith('alice:recipe');
    expect(queue.deleteClaimed).toHaveBeenCalledWith('user', 'alice:recipe', 100);
    expect(queue.resetAttempt).not.toHaveBeenCalled();
  });

  it('drops the task of a legacy user key once its rows are deleted', async () => {
    const { worker, queue, rebuild } = setup({ tasks: [task('alice:book,product')] });
    rebuild.rebuildUserScope.mockResolvedValue('legacy_deleted');

    await worker.runBatch();

    expect(queue.deleteClaimed).toHaveBeenCalledWith('user', 'alice:book,product', 100);
  });

  it('rebuilds the global scope', async () => {
    const { worker, queue, rebuild } = setup({ tasks: [task('_', { scope_type: 'global' })] });

    await worker.runBatch();

    expect(rebuild.rebuildGlobalScope).toHaveBeenCalledTimes(1);
    expect(rebuild.rebuildUserScope).not.toHaveBeenCalled();
    expect(queue.deleteClaimed).toHaveBeenCalledWith('global', '_', 100);
  });

  describe('type scope', () => {
    it('rebuilds a category type scope and marks it rebuilt', async () => {
      const { worker, queue, rebuild, throttle } = setup({
        tasks: [task('product', { scope_type: 'type' })],
      });

      await worker.runBatch();

      expect(rebuild.rebuildTypeScope).toHaveBeenCalledWith('product');
      expect(throttle.markRebuilt).toHaveBeenCalledWith('product');
      expect(queue.deleteClaimed).toHaveBeenCalledWith('type', 'product', 100);
    });

    it('does not mark a skipped non-category type and drops the task', async () => {
      const { worker, queue, rebuild, throttle } = setup({
        tasks: [task('restaurant', { scope_type: 'type' })],
      });
      rebuild.rebuildTypeScope.mockResolvedValue('not_category_type');

      await worker.runBatch();

      expect(throttle.markRebuilt).not.toHaveBeenCalled();
      expect(queue.deleteClaimed).toHaveBeenCalledWith('type', 'restaurant', 100);
    });

    it('does not claim type scopes rebuilt within the rate-limit interval', async () => {
      const { worker, queue } = setup({ tasks: [], throttled: ['product'] });

      await worker.runBatch();

      expect(queue.claimBatch).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), [
        'product',
      ]);
    });
  });

  describe('queue race and retries', () => {
    it('releases the row instead of losing it when the scope was re-enqueued during processing', async () => {
      const { worker, queue } = setup({ tasks: [task('alice:recipe')] });
      queue.deleteClaimed.mockResolvedValue(false);

      await worker.runBatch();

      expect(queue.resetAttempt).toHaveBeenCalledWith('user', 'alice:recipe');
    });

    it('keeps the row for retry when the rebuild fails below max attempts', async () => {
      const { worker, queue, rebuild } = setup({ tasks: [task('alice:recipe')] });
      rebuild.rebuildUserScope.mockRejectedValue(new Error('boom'));

      await worker.runBatch();

      expect(queue.deleteClaimed).not.toHaveBeenCalled();
      expect(queue.resetAttempt).toHaveBeenCalledWith('user', 'alice:recipe');
    });

    it('drops the row after max attempts unless it was re-enqueued', async () => {
      const { worker, queue, rebuild } = setup({
        tasks: [task('alice:recipe', { attempts: MAX_ATTEMPTS })],
      });
      rebuild.rebuildUserScope.mockRejectedValue(new Error('boom'));

      await worker.runBatch();

      expect(queue.deleteClaimed).toHaveBeenCalledWith('user', 'alice:recipe', 100);
      expect(queue.resetAttempt).not.toHaveBeenCalled();
    });
  });
});
