import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import type {
  ObjectCategoriesRelatedRow,
  ObjectCategoriesRelatedScopeType,
} from '@opden-data-layer/odl-db-types';

import { buildUserCategoryScopeKey } from '@opden-data-layer/core';

@Injectable()
export class ObjectCategoriesRelatedRepository {
  private readonly logger = new Logger(ObjectCategoriesRelatedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** Precomputed category rows of one scope (`user` → `acc:type`, `type` → the object type). */
  async findByScope(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
  ): Promise<ObjectCategoriesRelatedRow[]> {
    const key = scopeKey.trim();
    if (key.length === 0) {
      return [];
    }
    try {
      return await this.db
        .selectFrom('object_categories_related')
        .where('scope_type', '=', scopeType)
        .where('scope_key', '=', key)
        .selectAll()
        .execute();
    } catch (error) {
      this.logger.error(
        `findByScope failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

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
    return this.findByScope('user', buildUserCategoryScopeKey(name, type));
  }
}
