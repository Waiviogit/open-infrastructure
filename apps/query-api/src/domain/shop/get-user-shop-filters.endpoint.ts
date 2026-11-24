import { Injectable } from '@nestjs/common';
import { ObjectCategoriesRepository } from '../../repositories';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import { parseTagFilters } from '../discover/get-discover-objects.endpoint';
import { groupDiscoverTagCategories } from '../discover/discover-tag-categories.utils';
import { UserFavoritesScopeResolver } from '../favorites/user-favorites-scope.resolver';
import { resolveFavoritesOtherExcludedNames } from './favorites-other';
import { SHOP_RATING_FILTER_THRESHOLDS } from './shop.constants';
import { getTagCategoryOrderForShopTypes } from './shop-registry.utils';
import type { ShopFiltersQuery } from './shop.schema';
import type { UserShopFiltersResponseDto } from './shop.types';

@Injectable()
export class GetUserShopFiltersEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly navigation: CategoryNavigationService,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
  ) {}

  async execute(
    username: string,
    query: ShopFiltersQuery,
  ): Promise<UserShopFiltersResponseDto | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }

    const scope = await this.scopeResolver.resolve(name, query.types);
    const excludedCategoryNames = query.other
      ? await resolveFavoritesOtherExcludedNames(this.navigation, scope, query.categoryPath)
      : [];
    const rows =
      excludedCategoryNames == null
        ? []
        : await this.objectCategoriesRepo.getTagCategoriesByScope({
      scope,
      categoryPath: query.categoryPath,
      uncategorizedOnly: query.other ? false : query.uncategorizedOnly,
      excludedCategoryNames,
      tags: parseTagFilters(query.tags ?? []),
      rating: query.rating ?? null,
    });

    const order = getTagCategoryOrderForShopTypes(scope.types);
    const grouped = groupDiscoverTagCategories(rows, order);

    return {
      ratings: [...SHOP_RATING_FILTER_THRESHOLDS],
      categories: grouped.categories,
    };
  }
}
