import type { Kysely } from 'kysely';
import type { Database } from '../../database';
import type { FeedActivityBucketsRepository } from '../../repositories/feed-activity-buckets.repository';
import { FeedActivityBucketsService } from './feed-activity-buckets.service';

const HOUR = 3_600;
const NOW = 1_000 * HOUR + 42;

function setup() {
  const trx = { marker: 'trx' };
  const db = {
    transaction: () => ({
      execute: async <T>(fn: (t: unknown) => Promise<T>) => fn(trx),
    }),
  } as unknown as Kysely<Database>;
  const calls: string[] = [];
  const buckets = {
    lockTab: jest.fn(async (tab: string) => {
      calls.push(`lock:${tab}`);
    }),
    deleteFromHour: jest.fn(async (tab: string, from: number) => {
      calls.push(`delete:${tab}:${from / HOUR}`);
      return 0;
    }),
    insertCountsFromHour: jest.fn(async (tab: string) => {
      calls.push(`insert:${tab}`);
      return 3;
    }),
    deleteBeforeHour: jest.fn(async () => 5),
  } as unknown as FeedActivityBucketsRepository;
  return { service: new FeedActivityBucketsService(db, buckets), buckets, calls };
}

describe('FeedActivityBucketsService', () => {
  it('refresh recounts the last two hours of every tab without pruning', async () => {
    const { service, buckets, calls } = setup();

    const summary = await service.run('refresh', new AbortController().signal, NOW);

    expect(summary).toEqual({ mode: 'refresh', fromHour: 999 * HOUR, writtenRows: 12, prunedRows: 0 });
    expect(calls).toEqual([
      'lock:posts', 'delete:posts:999', 'insert:posts',
      'lock:threads', 'delete:threads:999', 'insert:threads',
      'lock:activity', 'delete:activity:999', 'insert:activity',
      'lock:updates', 'delete:updates:999', 'insert:updates',
    ]);
    expect(buckets.deleteBeforeHour).not.toHaveBeenCalled();
  });

  it('rebuild recounts the 3-day window and prunes past retention', async () => {
    const { service, buckets } = setup();

    const summary = await service.run('rebuild', new AbortController().signal, NOW);

    expect(summary.fromHour).toBe((1_000 - 71) * HOUR);
    expect(summary.prunedRows).toBe(5);
    expect(buckets.deleteBeforeHour).toHaveBeenCalledWith((1_000 - 95) * HOUR);
  });

  it('stops before the next tab once aborted', async () => {
    const { service, buckets } = setup();
    const controller = new AbortController();
    controller.abort();

    const summary = await service.run('rebuild', controller.signal, NOW);

    expect(summary.writtenRows).toBe(0);
    expect(buckets.lockTab).not.toHaveBeenCalled();
    expect(buckets.deleteBeforeHour).not.toHaveBeenCalled();
  });
});
