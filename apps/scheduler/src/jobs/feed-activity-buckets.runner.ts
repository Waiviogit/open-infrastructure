import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { JobHandlerContext } from './cron-job.types';
import {
  FeedActivityBucketsService,
  type FeedActivityBucketsMode,
} from '../domain/feed-activity-buckets/feed-activity-buckets.service';

let runnerRef: FeedActivityBucketsRunner | null = null;

function registerFeedActivityBucketsRunner(r: FeedActivityBucketsRunner): void {
  runnerRef = r;
}

export function getFeedActivityBucketsRunnerForJob(): FeedActivityBucketsRunner {
  if (!runnerRef) {
    throw new Error('FeedActivityBucketsRunner is not registered yet');
  }
  return runnerRef;
}

@Injectable()
export class FeedActivityBucketsRunner implements OnModuleInit {
  private readonly logger = new Logger(FeedActivityBucketsRunner.name);

  constructor(private readonly service: FeedActivityBucketsService) {}

  onModuleInit(): void {
    registerFeedActivityBucketsRunner(this);
  }

  async run(mode: FeedActivityBucketsMode, ctx: JobHandlerContext): Promise<void> {
    if (ctx.signal.aborted) {
      return;
    }
    const summary = await this.service.run(mode, ctx.signal);
    this.logger.log(
      `feed-activity-buckets ${summary.mode}: from=${summary.fromHour} written=${summary.writtenRows} presence=${summary.presenceRows} pruned=${summary.prunedRows}`,
    );
  }
}
