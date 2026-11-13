import { Logger } from '@nestjs/common';
import type { CronJobDefinition } from './cron-job.types';
import { getFeedActivityBucketsRunnerForJob } from './feed-activity-buckets.runner';

const logger = new Logger('feed-activity-buckets-refresh');

/**
 * Every 5 minutes: recount hub feed counter buckets of the last hours.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
export const feedActivityBucketsRefreshJob: CronJobDefinition = {
  name: 'feed-activity-buckets-refresh',
  schedule: '*/5 * * * *',
  category: 'light',
  enabled: true,
  timeoutMs: 240_000,
  lockTtlSec: 60,
  retryCount: 0,
  retryDelayMs: 10_000,
  allowOverlap: false,
  run: async (ctx) => {
    logger.log(`run ${ctx.runId} attempt ${ctx.attempt}`);
    await getFeedActivityBucketsRunnerForJob().run('refresh', ctx);
  },
};
