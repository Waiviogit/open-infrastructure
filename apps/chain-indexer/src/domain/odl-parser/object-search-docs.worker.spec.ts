import { Logger } from '@nestjs/common';
import type { ObjectSearchQueueTask } from '@opden-data-layer/object-search';

import { OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC } from '../../constants/object-search-docs.constants';
import { ObjectSearchDocsWorker } from './object-search-docs.worker';

const GOVERNANCE = { admins: [], inherits_from: [] };
const REBUILD_RESULT = { loaded: 0, upserted: 0, deleted: 0, missing: 0 };

function task(objectId: string, overrides: Partial<ObjectSearchQueueTask> = {}): ObjectSearchQueueTask {
  return { object_id: objectId, enqueued_at: 100, attempts: 1, ...overrides };
}

function setup(opts: { batchSize?: number; maxBatchesPerTick?: number } = {}) {
  const settings: Record<string, number> = {
    'objectSearchDocs.intervalMs': 3_000,
    'objectSearchDocs.batchSize': opts.batchSize ?? 2,
    'objectSearchDocs.maxBatchesPerTick': opts.maxBatchesPerTick ?? 3,
  };
  const configService = { getOrThrow: jest.fn((key: string) => settings[key]) };
  const queue = {
    claimBatch: jest.fn<Promise<ObjectSearchQueueTask[]>, [number, number]>(),
    finishClaimed: jest.fn<Promise<void>, [readonly ObjectSearchQueueTask[]]>(),
    releaseClaimed: jest.fn<Promise<void>, [readonly string[]]>(),
  };
  queue.claimBatch.mockResolvedValue([]);
  queue.finishClaimed.mockResolvedValue(undefined);
  queue.releaseClaimed.mockResolvedValue(undefined);
  const rebuildService = {
    rebuild: jest.fn<Promise<typeof REBUILD_RESULT>, [readonly string[], unknown]>(),
  };
  rebuildService.rebuild.mockResolvedValue(REBUILD_RESULT);
  const governanceCacheService = { resolvePlatform: jest.fn().mockResolvedValue(GOVERNANCE) };
  const worker = new ObjectSearchDocsWorker(
    configService as never,
    {} as never,
    queue as never,
    rebuildService as never,
    governanceCacheService as never,
  );
  return { worker, queue, rebuildService, governanceCacheService };
}

describe('ObjectSearchDocsWorker', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rebuilds a claimed batch with the platform governance and finishes it', async () => {
    const { worker, queue, rebuildService } = setup();
    const tasks = [task('o1')];
    queue.claimBatch.mockResolvedValueOnce(tasks);

    await worker.tick();

    expect(queue.claimBatch).toHaveBeenCalledWith(2, OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC);
    expect(rebuildService.rebuild).toHaveBeenCalledWith(['o1'], GOVERNANCE);
    expect(queue.finishClaimed).toHaveBeenCalledWith(tasks);
    expect(queue.releaseClaimed).not.toHaveBeenCalled();
  });

  it('keeps draining while batches come back full', async () => {
    const { worker, queue, rebuildService } = setup({ batchSize: 2, maxBatchesPerTick: 5 });
    queue.claimBatch
      .mockResolvedValueOnce([task('o1'), task('o2')])
      .mockResolvedValueOnce([task('o3'), task('o4')])
      .mockResolvedValueOnce([task('o5')]);

    await worker.tick();

    expect(queue.claimBatch).toHaveBeenCalledTimes(3);
    expect(rebuildService.rebuild).toHaveBeenCalledTimes(3);
    expect(queue.finishClaimed).toHaveBeenCalledTimes(3);
  });

  it('stops after maxBatchesPerTick full batches', async () => {
    const { worker, queue } = setup({ batchSize: 1, maxBatchesPerTick: 3 });
    queue.claimBatch.mockImplementation(async () => [task('o1')]);

    await worker.tick();

    expect(queue.claimBatch).toHaveBeenCalledTimes(3);
  });

  it('stops on an empty claim', async () => {
    const { worker, queue, rebuildService } = setup();

    await worker.tick();

    expect(queue.claimBatch).toHaveBeenCalledTimes(1);
    expect(rebuildService.rebuild).not.toHaveBeenCalled();
    expect(queue.finishClaimed).not.toHaveBeenCalled();
  });

  it('skips a tick while the previous one is still running', async () => {
    const { worker, queue } = setup();
    let releaseClaim: (tasks: ObjectSearchQueueTask[]) => void = () => undefined;
    queue.claimBatch.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseClaim = resolve;
      }),
    );

    const first = worker.tick();
    await worker.tick();
    expect(queue.claimBatch).toHaveBeenCalledTimes(1);

    releaseClaim([]);
    await first;
    await worker.tick();
    expect(queue.claimBatch).toHaveBeenCalledTimes(2);
  });

  it('retries a failed batch one by one and keeps the failing id queued', async () => {
    const { worker, queue, rebuildService } = setup();
    const ok = task('o1');
    const bad = task('o2', { attempts: 4 });
    queue.claimBatch.mockResolvedValueOnce([ok, bad]).mockResolvedValueOnce([]);
    rebuildService.rebuild.mockImplementation(async (ids) => {
      if (ids.includes('o2')) {
        throw new Error('bad source row');
      }
      return REBUILD_RESULT;
    });

    await worker.tick();

    expect(rebuildService.rebuild.mock.calls.map(([ids]) => ids)).toEqual([
      ['o1', 'o2'],
      ['o1'],
      ['o2'],
    ]);
    expect(queue.finishClaimed).toHaveBeenCalledTimes(1);
    expect(queue.finishClaimed).toHaveBeenCalledWith([ok]);
    expect(queue.releaseClaimed).toHaveBeenCalledWith(['o2']);
    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/'o2'.*attempts 4.*bad source row/));
  });

  it('releases the claimed rows when governance cannot be resolved', async () => {
    const { worker, queue, rebuildService, governanceCacheService } = setup();
    queue.claimBatch.mockResolvedValueOnce([task('o1')]);
    governanceCacheService.resolvePlatform.mockRejectedValueOnce(new Error('redis down'));

    await worker.tick();

    expect(rebuildService.rebuild).not.toHaveBeenCalled();
    expect(queue.finishClaimed).not.toHaveBeenCalled();
    expect(queue.releaseClaimed).toHaveBeenCalledWith(['o1']);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('redis down'));
  });

  it('keeps a row re-enqueued while its batch was processed', async () => {
    const { worker, queue, rebuildService } = setup();
    // In-memory queue with the repository contract: re-enqueue bumps `enqueued_at`, and
    // `finishClaimed` removes a row only when `enqueued_at` is not newer than the claimed one.
    const rows = new Map<string, number>([['o1', 100]]);
    queue.claimBatch.mockImplementationOnce(async () =>
      [...rows].map(([object_id, enqueued_at]) => task(object_id, { enqueued_at })),
    );
    rebuildService.rebuild.mockImplementationOnce(async () => {
      rows.set('o1', (rows.get('o1') ?? 0) + 1);
      return REBUILD_RESULT;
    });
    queue.finishClaimed.mockImplementation(async (tasks) => {
      for (const claimed of tasks) {
        if ((rows.get(claimed.object_id) ?? 0) <= claimed.enqueued_at) {
          rows.delete(claimed.object_id);
        }
      }
    });

    await worker.tick();

    expect(queue.finishClaimed).toHaveBeenCalledWith([task('o1', { enqueued_at: 100 })]);
    expect(rows.get('o1')).toBe(101);
  });
});
