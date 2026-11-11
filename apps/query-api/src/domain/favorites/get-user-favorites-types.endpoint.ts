import { Injectable } from '@nestjs/common';
import { objectTypeSupportsCategories } from '@opden-data-layer/core';
import {
  UserFavoritesRepository,
  type UserFavoritesScope,
  type UserFavoritesTypeCountRow,
} from '../../repositories';
import { UserCategoryNavigationService } from '../categories/user-category-navigation.service';
import type { UserFavoritesTypeItem, UserFavoritesTypesResponse } from './favorites.schema';
import { narrowUserFavoritesScope, UserFavoritesScopeResolver } from './user-favorites-scope.resolver';

@Injectable()
export class GetUserFavoritesTypesEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly favoritesRepo: UserFavoritesRepository,
    private readonly navigation: UserCategoryNavigationService,
  ) {}

  async execute(username: string): Promise<UserFavoritesTypesResponse> {
    const name = username.trim();
    if (name.length === 0) {
      return { types: [], items: [] };
    }

    const scope = await this.scopeResolver.resolve(name);
    const rows = await this.favoritesRepo.findTypesByScope(scope);
    const items = await Promise.all(rows.map((row) => this.toItem(scope, row)));
    return { types: items.map((item) => item.object_type), items };
  }

  private async toItem(
    scope: UserFavoritesScope,
    row: UserFavoritesTypeCountRow,
  ): Promise<UserFavoritesTypeItem> {
    const supportsCategories = objectTypeSupportsCategories(row.object_type);
    return {
      object_type: row.object_type,
      objects_count: row.objects_count,
      supports_categories: supportsCategories,
      has_categories:
        supportsCategories &&
        row.categorized_count > 0 &&
        (await this.hasRootCategories(scope, row.object_type)),
    };
  }

  /**
   * True when the category root would list at least one category — the same navigation the
   * `categories` endpoint returns, so the client never shows a chevron over an empty panel
   * (e.g. while precomputed scope rows are still being rebuilt).
   */
  private async hasRootCategories(scope: UserFavoritesScope, objectType: string): Promise<boolean> {
    const root = await this.navigation.build({
      scope: narrowUserFavoritesScope(scope, objectType),
      objectType,
      lineage: [],
      excluded: [],
      includeHasChildren: false,
    });
    return root.items.length > 0;
  }
}
