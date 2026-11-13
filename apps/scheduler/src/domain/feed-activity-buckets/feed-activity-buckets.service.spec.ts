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
    lock: jest.fn(async (scope: string, tab: string) => {
      calls.push(`lock:${scope}:${tab}`);
    }),
    deleteBucketsFromHour: jest.fn(async (tab: string, from: number) => {
      calls.push(`delete:${tab}:${from / HOUR}`);
      return 0;
    }),
    insertBucketsFromHour: jest.fn(async (tab: string) => {
      calls.push(`insert:${tab}`);
      return 3;
    }),
    upsertPresenceSince: jest.fn(async (tab: string, from: number) => {
      calls.push(`presence:${tab}:${from / HOUR}`);
      return 2;
    }),
    deletePresence: jest.fn(async (tab: string) => {
      calls.push(`clear-presence:${tab}`);
      return 1;
    }),
    deleteBucketsBeforeHour: jest.fn(async () => 5),
  } as unknown as FeedActivityBucketsRepository;
  return { service: new FeedActivityBucketsService(db, buckets), buckets, calls };
}

describe('FeedActivityBucketsService', () => {
  it('refresh recounts the last two hours of every tab and marks their entities present', async () => {
    const { service, buckets, calls } = setup();

    const summary = await service.run('refresh', new AbortController().signal, NOW);

    expect(summary).toEqual({
      mode: 'refresh',
      fromHour: 999 * HOUR,
      writtenRows: 12,
      presenceRows: 8,
      prunedRows: 0,
    });
    expect(calls.slice(0, 5)).toEqual([
      'lock:buckets:posts',
      'delete:posts:999',
      'insert:posts',
      'lock:presence:posts',
      'presence:posts:999',
    ]);
    expect(buckets.deleteBucketsBeforeHour).not.toHaveBeenCalled();
    expect(buckets.deletePresence).not.toHaveBeenCalled();
  });

  it('rebuild recounts the 3-day window and prunes past retention', async () => {
    const { service, buckets } = setup();

    const summary = await service.run('rebuild', new AbortController().signal, NOW);

    expect(summary.fromHour).toBe((1_000 - 71) * HOUR);
    expect(summary.prunedRows).toBe(5);
    expect(buckets.deleteBucketsBeforeHour).toHaveBeenCalledWith((1_000 - 95) * HOUR);
  });

  it('presence rebuilds every tab from full history without touching buckets', async () => {
    const { service, buckets, calls } = setup();

    const summary = await service.run('presence', new AbortController().signal, NOW);

    expect(summary.presenceRows).toBe(8);
    expect(calls).toEqual(
      ['posts', 'threads', 'activity', 'updates'].flatMap((tab) => [
        `lock:presence:${tab}`,
        `clear-presence:${tab}`,
        `presence:${tab}:0`,
      ]),
    );
    expect(buckets.insertBucketsFromHour).not.toHaveBeenCalled();
  });

  it('stops before the next tab once aborted', async () => {
    const { service, buckets } = setup();
    const controller = new AbortController();
    controller.abort();

    const summary = await service.run('rebuild', controller.signal, NOW);

    expect(summary.writtenRows).toBe(0);
    expect(buckets.lock).not.toHaveBeenCalled();
    expect(buckets.deleteBucketsBeforeHour).not.toHaveBeenCalled();
  });
});
