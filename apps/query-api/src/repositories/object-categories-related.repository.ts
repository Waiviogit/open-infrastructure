import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';

import { buildUserCategoryScopeKey } from '@opden-data-layer/core';

@Injectable()
export class ObjectCategoriesRelatedRepository {
  private readonly logger = new Logger(ObjectCategoriesRelatedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** Precomputed category rows for one account and one category object type (`acc:type`). */
  async findByUserCategoryScope(
    username: string,
    objectType: string,
  ): Promise<ObjectCategoriesRelatedRow[]> {
    const name = username.trim();
    const type = objectType.trim();
    if (name.length === 0 || type.length === 0) {
      return [];
    }
    try {
      return await this.db
        .selectFrom('object_categories_related')
        .where('scope_type', '=', 'user')
        .where('scope_key', '=', buildUserCategoryScopeKey(name, type))
        .selectAll()
        .execute();
    } catch (error) {
      this.logger.error(
        `findByUserCategoryScope failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
