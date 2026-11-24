import { objectTypeSupportsCategories } from '@opden-data-layer/core';

import type { DiscoverTagFilter } from '../../repositories/discover-object-filters.sql';
import type { CategoryNavigationService } from '../categories/category-navigation.service';
import type { DiscoverBox } from './discover-query.schema';

export type DiscoverOtherLevel = {
  objectType: string | undefined;
  categoryPath: readonly string[];
  q: string;
  tags: readonly DiscoverTagFilter[];
  box: DiscoverBox | null;
};

/**
 * Child categories the Discover tree shows at `categoryPath` under the same search / tags / map
 * area (what the virtual Other category leaves out). `null` when the type has no category tree.
 * @see docs/apps/query-api/spec/discover-categories.md
 */
export async function resolveDiscoverOtherExcludedNames(
  navigation: CategoryNavigationService,
  level: DiscoverOtherLevel,
): Promise<string[] | null> {
  const objectType = level.objectType?.trim() ?? '';
  if (!objectTypeSupportsCategories(objectType)) {
    return null;
  }
  return navigation.visibleCategoryNames({
    scope: { kind: 'type', objectType, q: level.q, tags: level.tags, box: level.box },
    objectType,
    lineage: level.categoryPath,
  });
}
