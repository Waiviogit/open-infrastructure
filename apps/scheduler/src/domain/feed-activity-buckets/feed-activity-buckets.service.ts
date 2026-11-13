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

export type FeedActivityBucketsMode = 'refresh' | 'rebuild';

export interface FeedActivityBucketsRunSummary {
  mode: FeedActivityBucketsMode;
  fromHour: number;
  writtenRows: number;
  prunedRows: number;
}

/**
 * Rebuilds `feed_activity_buckets` from content tables. Each tab is replaced from
 * `fromHour` onward in its own transaction (delete range, recount), so runs are idempotent.
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
    const hours =
      mode === 'rebuild' ? FEED_ACTIVITY_BUCKETS_WINDOW_HOURS : FEED_ACTIVITY_BUCKETS_REFRESH_HOURS;
    const fromHour = bucketRangeStart(nowUnixSec, hours);
    let writtenRows = 0;

    for (const tab of FEED_ACTIVITY_BUCKET_TABS) {
      if (signal.aborted) {
        this.logger.warn(`feed-activity-buckets ${mode}: aborted before tab ${tab}`);
        return { mode, fromHour, writtenRows, prunedRows: 0 };
      }
      writtenRows += await this.replaceTabFromHour(tab, fromHour);
    }

    const prunedRows =
      mode === 'rebuild'
        ? await this.buckets.deleteBeforeHour(
            bucketRangeStart(nowUnixSec, FEED_ACTIVITY_BUCKETS_RETENTION_HOURS),
          )
        : 0;

    return { mode, fromHour, writtenRows, prunedRows };
  }

  private async replaceTabFromHour(tab: FeedActivityBucketTab, fromHour: number): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      await this.buckets.lockTab(tab, trx);
      await this.buckets.deleteFromHour(tab, fromHour, trx);
      return this.buckets.insertCountsFromHour(tab, fromHour, trx);
    });
  }
}
