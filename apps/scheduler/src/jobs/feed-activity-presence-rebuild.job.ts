import { Logger } from '@nestjs/common';
import type { CronJobDefinition } from './cron-job.types';
import { getFeedActivityBucketsRunnerForJob } from './feed-activity-buckets.runner';

const logger = new Logger('feed-activity-presence-rebuild');

/**
 * Weekly: rebuild "who has items on each hub tab" from full history, dropping accounts and
 * objects whose items are gone. Heavy (scans every content table); run once by hand right
 * after migration 00076.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
export const feedActivityPresenceRebuildJob: CronJobDefinition = {
  name: 'feed-activity-presence-rebuild',
  schedule: '40 4 * * 0',
  category: 'batch',
  enabled: true,
  timeoutMs: 7_200_000,
  lockTtlSec: 120,
  retryCount: 1,
  retryDelayMs: 300_000,
  allowOverlap: false,
  run: async (ctx) => {
    logger.log(`run ${ctx.runId} attempt ${ctx.attempt}`);
    await getFeedActivityBucketsRunnerForJob().run('presence', ctx);
  },
};
