import { Logger } from '@nestjs/common';
import type { CronJobDefinition } from './cron-job.types';
import { getFeedActivityBucketsRunnerForJob } from './feed-activity-buckets.runner';

const logger = new Logger('feed-activity-buckets-rebuild');

/**
 * Daily: recount the whole 3-day counter window (picks up late-indexed items)
 * and prune buckets past retention. Run once by hand right after the migration.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
export const feedActivityBucketsRebuildJob: CronJobDefinition = {
  name: 'feed-activity-buckets-rebuild',
  schedule: '20 4 * * *',
  category: 'batch',
  enabled: true,
  timeoutMs: 1_800_000,
  lockTtlSec: 120,
  retryCount: 1,
  retryDelayMs: 60_000,
  allowOverlap: false,
  run: async (ctx) => {
    logger.log(`run ${ctx.runId} attempt ${ctx.attempt}`);
    await getFeedActivityBucketsRunnerForJob().run('rebuild', ctx);
  },
};
