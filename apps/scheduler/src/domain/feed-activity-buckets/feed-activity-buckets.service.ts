import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';
import { KYSELY, type Database } from '../../database';
import { FeedActivityBucketsRepository } from '../../repositories/feed-activity-buckets.repository';
import {
  FEED_ACTIVITY_BUCKET_TABS,
  FEED_ACTIVITY_BUCKETS_REFRESH_HOURS,
  FEED_ACTIVITY_BUCKETS_RETENTION_HOURS,
  FEED_ACTIVITY_BUCKETS_WINDOW_HOURS,
} from '../../constants/feed-activity-buckets.constants';
import { bucketRangeStart } from './feed-activity-window';

/**
 * - `refresh`: recount the last hours of every tab and mark their entities present.
 * - `rebuild`: recount the whole counter window, mark present, prune old buckets.
 * - `presence`: rebuild presence of every tab from full history (drops entities whose
 *   items are gone).
 */
export type FeedActivityBucketsMode = 'refresh' | 'rebuild' | 'presence';

export interface FeedActivityBucketsRunSummary {
  mode: FeedActivityBucketsMode;
  fromHour: number;
  writtenRows: number;
  presenceRows: number;
  prunedRows: number;
}

/**
 * Keeps `feed_activity_buckets` and `feed_activity_presence` in step with content tables.
 * Each tab is replaced in its own transaction (lock, delete range, recount), so runs are
 * idempotent; presence upserts only move `last_item_unix` forward.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
@Injectable()
export class FeedActivityBucketsService {
  private readonly logger = new Logger(FeedActivityBucketsService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly buckets: FeedActivityBucketsRepository,
  ) {}

  async run(
    mode: FeedActivityBucketsMode,
    signal: AbortSignal,
    nowUnixSec: number = Math.floor(Date.now() / 1000),
  ): Promise<FeedActivityBucketsRunSummary> {
    if (mode === 'presence') {
      return this.rebuildPresence(signal);
    }

    const hours =
      mode === 'rebuild' ? FEED_ACTIVITY_BUCKETS_WINDOW_HOURS : FEED_ACTIVITY_BUCKETS_REFRESH_HOURS;
    const fromHour = bucketRangeStart(nowUnixSec, hours);
    let writtenRows = 0;
    let presenceRows = 0;

    for (const tab of FEED_ACTIVITY_BUCKET_TABS) {
      if (signal.aborted) {
        this.logger.warn(`feed-activity-buckets ${mode}: aborted before tab ${tab}`);
        return { mode, fromHour, writtenRows, presenceRows, prunedRows: 0 };
      }
      const written = await this.replaceTabFromHour(tab, fromHour);
      writtenRows += written.buckets;
      presenceRows += written.presence;
    }

    const prunedRows =
      mode === 'rebuild'
        ? await this.buckets.deleteBucketsBeforeHour(
            bucketRangeStart(nowUnixSec, FEED_ACTIVITY_BUCKETS_RETENTION_HOURS),
          )
        : 0;

    return { mode, fromHour, writtenRows, presenceRows, prunedRows };
  }

  private async replaceTabFromHour(
    tab: FeedActivityBucketTab,
    fromHour: number,
  ): Promise<{ buckets: number; presence: number }> {
    return this.db.transaction().execute(async (trx) => {
      await this.buckets.lock('buckets', tab, trx);
      await this.buckets.deleteBucketsFromHour(tab, fromHour, trx);
      const buckets = await this.buckets.insertBucketsFromHour(tab, fromHour, trx);
      await this.buckets.lock('presence', tab, trx);
      const presence = await this.buckets.upsertPresenceSince(tab, fromHour, trx);
      return { buckets, presence };
    });
  }

  private async rebuildPresence(signal: AbortSignal): Promise<FeedActivityBucketsRunSummary> {
    let presenceRows = 0;
    for (const tab of FEED_ACTIVITY_BUCKET_TABS) {
      if (signal.aborted) {
        this.logger.warn(`feed-activity-buckets presence: aborted before tab ${tab}`);
        break;
      }
      presenceRows += await this.db.transaction().execute(async (trx) => {
        await this.buckets.lock('presence', tab, trx);
        await this.buckets.deletePresence(tab, trx);
        return this.buckets.upsertPresenceSince(tab, 0, trx);
      });
    }
    return { mode: 'presence', fromHour: 0, writtenRows: 0, presenceRows, prunedRows: 0 };
  }
}
