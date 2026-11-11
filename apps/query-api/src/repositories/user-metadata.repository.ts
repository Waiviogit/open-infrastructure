import { Injectable, Inject, Logger } from '@nestjs/common';
import type { UserFavoritesVisibilityFlags } from '@opden-data-layer/core';
import type { Kysely } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';

@Injectable()
export class UserMetadataRepository {
  private readonly logger = new Logger(UserMetadataRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Per-type post-link hide flags for the Favorites scope. Missing row → all false (posts visible).
   */
  async findShopVisibilityFlags(account: string): Promise<UserFavoritesVisibilityFlags> {
    const trimmed = account.trim();
    if (trimmed.length === 0) {
      return {
        hide_linked_objects: false,
        hide_recipe_objects: false,
        hide_favorite_objects: false,
      };
    }
    try {
      const row = await this.db
        .selectFrom('user_metadata')
        .select(['hide_linked_objects', 'hide_recipe_objects', 'hide_favorite_objects'])
        .where('account', '=', trimmed)
        .executeTakeFirst();
      if (!row) {
        return {
          hide_linked_objects: false,
          hide_recipe_objects: false,
          hide_favorite_objects: false,
        };
      }
      return {
        hide_linked_objects: row.hide_linked_objects,
        hide_recipe_objects: row.hide_recipe_objects,
        hide_favorite_objects: row.hide_favorite_objects,
      };
    } catch (error) {
      this.logger.error(
        `findShopVisibilityFlags failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        hide_linked_objects: false,
        hide_recipe_objects: false,
        hide_favorite_objects: false,
      };
    }
  }
}
