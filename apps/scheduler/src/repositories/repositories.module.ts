import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { ObjectSearchQueueRepository } from '@opden-data-layer/object-search';
import { KYSELY, type Database } from '../database';
import { PostsRewardRepository } from './posts-reward.repository';
import { SchedulerRepository } from './scheduler.repository';
import { HiveEngineRatesRepository } from './hive-engine-rates.repository';
import { PostObjectsRepository } from './post-objects.repository';
import { PostExpertiseRepository } from './post-expertise.repository';
import { FeedActivityBucketsRepository } from './feed-activity-buckets.repository';

@Module({
  providers: [
    SchedulerRepository,
    PostsRewardRepository,
    HiveEngineRatesRepository,
    PostObjectsRepository,
    PostExpertiseRepository,
    FeedActivityBucketsRepository,
    {
      provide: ObjectSearchQueueRepository,
      inject: [KYSELY],
      useFactory: (db: Kysely<Database>) => new ObjectSearchQueueRepository(db),
    },
  ],
  exports: [
    SchedulerRepository,
    PostsRewardRepository,
    HiveEngineRatesRepository,
    PostObjectsRepository,
    PostExpertiseRepository,
    FeedActivityBucketsRepository,
    ObjectSearchQueueRepository,
  ],
})
export class RepositoriesModule {}
