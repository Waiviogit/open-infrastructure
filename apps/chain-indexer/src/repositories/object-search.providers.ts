import type { Provider } from '@nestjs/common';
import {
  OBJECT_SEARCH_SINKS,
  ObjectSearchQueueRepository,
  ObjectSearchRebuildService,
  ObjectSearchSourceRepository,
  PostgresObjectSearchSink,
  type ObjectSearchSink,
} from '@opden-data-layer/object-search';
import type { Kysely } from 'kysely';

import { KYSELY, type Database } from '../database';

/** Object search documents from `@opden-data-layer/object-search` over the indexer's Kysely. */
export const ObjectSearchProviders: Provider[] = [
  {
    provide: ObjectSearchQueueRepository,
    useFactory: (db: Kysely<Database>) => new ObjectSearchQueueRepository(db),
    inject: [KYSELY],
  },
  {
    provide: ObjectSearchSourceRepository,
    useFactory: (db: Kysely<Database>) => new ObjectSearchSourceRepository(db),
    inject: [KYSELY],
  },
  {
    provide: PostgresObjectSearchSink,
    useFactory: (db: Kysely<Database>) => new PostgresObjectSearchSink(db),
    inject: [KYSELY],
  },
  {
    provide: OBJECT_SEARCH_SINKS,
    useFactory: (postgres: PostgresObjectSearchSink): ObjectSearchSink[] => [postgres],
    inject: [PostgresObjectSearchSink],
  },
  {
    provide: ObjectSearchRebuildService,
    useFactory: (source: ObjectSearchSourceRepository, sinks: ObjectSearchSink[]) =>
      new ObjectSearchRebuildService(source, sinks),
    inject: [ObjectSearchSourceRepository, OBJECT_SEARCH_SINKS],
  },
];
