import 'server-only';

import { isUncategorizedLineage } from '../../domain/favorites-path';
import type { CategoryNavData } from '../../domain/types/category-nav';
import { getCategoryNav } from '../../infrastructure/clients/categories.client';
import { apiNavContextFromLineage } from '../../domain/category-nav-path';

export type FavoritesRailNav = {
  /** Null when query-api failed. */
  data: CategoryNavData | null;
  /** Lineage whose children `data.items` are. */
  navLineage: string[];
};

/**
 * Category nav for the Favorites left rail. Uncategorized shows the type root; a leaf (no child
 * categories) shows its siblings so the open category stays visible and highlighted.
 */
export async function getFavoritesRailNavQuery(
  accountName: string,
  objectType: string,
  lineage: readonly string[],
): Promise<FavoritesRailNav> {
  const navLineage = isUncategorizedLineage(lineage) ? [] : [...lineage];
  const data = await getCategoryNav(accountName, objectType, apiNavContextFromLineage(navLineage));
  if (data === null || data.items.length > 0 || navLineage.length === 0) {
    return { data, navLineage };
  }
  const parentLineage = navLineage.slice(0, -1);
  const parent = await getCategoryNav(
    accountName,
    objectType,
    apiNavContextFromLineage(parentLineage),
  );
  return parent ? { data: parent, navLineage: parentLineage } : { data, navLineage };
}
