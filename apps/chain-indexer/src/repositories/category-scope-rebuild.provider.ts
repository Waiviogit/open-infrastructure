import type { Provider } from '@nestjs/common';
import {
  CategoryScopeRebuildService,
  CategoryScopeRepository,
} from '@opden-data-layer/category-scopes';
import type { Kysely } from 'kysely';

import { KYSELY, type Database } from '../database';

/** Category scope rebuild from `@opden-data-layer/category-scopes` over the indexer's Kysely. */
export const CategoryScopeRebuildProvider: Provider = {
  provide: CategoryScopeRebuildService,
  useFactory: (db: Kysely<Database>) =>
    new CategoryScopeRebuildService(new CategoryScopeRepository(db)),
  inject: [KYSELY],
};
