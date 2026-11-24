import { objectTypeSupportsCategories } from '@opden-data-layer/core';

import type { UserFavoritesScope } from '../../repositories';
import type { CategoryNavigationService } from '../categories/category-navigation.service';

/**
 * Child categories the Favorites tree shows at `categoryPath` (what its virtual Other category
 * leaves out), as the rail lists them: unfiltered by tags and rating. `null` when the scope is
 * not one category type (no tree, so no Other).
 * @see docs/apps/query-api/spec/categories.md
 */
export async function resolveFavoritesOtherExcludedNames(
  navigation: CategoryNavigationService,
  scope: UserFavoritesScope,
  categoryPath: readonly string[],
): Promise<string[] | null> {
  const [objectType] = scope.types;
  if (scope.types.length !== 1 || objectType == null || !objectTypeSupportsCategories(objectType)) {
    return null;
  }
  return navigation.visibleCategoryNames({
    scope: { kind: 'user', scope, tags: [], rating: null },
    objectType,
    lineage: categoryPath,
  });
}
