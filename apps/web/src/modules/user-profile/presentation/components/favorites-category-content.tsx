import { getShopObjectsQuery } from '../../application/queries/get-shop-objects.query';
import { getShopSectionsQuery } from '../../application/queries/get-shop-sections.query';
import {
  buildShopListScopeKey,
  profileShopFiltersActive,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import type { CategoryNavData } from '../../domain/types/category-nav';
import {
  FAVORITES_OBJECTS_PAGE_SIZE,
  FAVORITES_SECTION_PREVIEW_LIMIT,
} from '../../domain/types/shop-objects';
import { apiNavContextFromLineage } from '../../domain/category-nav-path';
import { FavoritesObjectList } from './favorites-object-list';
import { FavoritesSections } from './favorites-sections';

export type FavoritesCategoryContentProps = {
  accountName: string;
  /** A type that supports the `category` update. */
  objectType: string;
  /** Category lineage of the URL (decoded segments). */
  lineageSegments: readonly string[];
  /** The URL shows the Other category of `lineageSegments`. */
  categoryOther: boolean;
  /** Category nav at `lineageSegments`; null when unavailable. */
  nav: CategoryNavData | null;
  shopFilters: ProfileShopFiltersState;
  viewerUsername: string | null;
};

/**
 * Center column of a category type. Three modes:
 * - the Other category or active tag/rating filters → flat object list (facet counts match rows);
 * - leaf node (no child categories) → flat object list of the lineage;
 * - inner node (the type root included) → child category sections, then the Other section (its
 *   objects in none of them; at the root also the uncategorized ones).
 */
export async function FavoritesCategoryContent({
  accountName,
  objectType,
  lineageSegments,
  categoryOther,
  nav,
  shopFilters,
  viewerUsername,
}: FavoritesCategoryContentProps) {
  const filterQuery = { tags: shopFilters.tags, rating: shopFilters.rating };
  const categoryPath = [...lineageSegments];
  const isLeaf = nav === null || nav.items.length === 0;

  if (categoryOther || profileShopFiltersActive(shopFilters) || isLeaf) {
    const page = await getShopObjectsQuery(
      accountName,
      {
        objectType,
        categoryPath,
        categoryOther: categoryOther ? true : undefined,
        limit: FAVORITES_OBJECTS_PAGE_SIZE,
        ...filterQuery,
      },
      viewerUsername,
    );

    return (
      <FavoritesObjectList
        key={buildShopListScopeKey(objectType, lineageSegments, categoryOther, shopFilters)}
        accountName={accountName}
        objectType={objectType}
        initialPage={page}
        categoryPath={categoryPath}
        categoryOther={categoryOther}
        shopFilters={shopFilters}
        viewerUsername={viewerUsername}
      />
    );
  }

  const { parentName, path } = apiNavContextFromLineage(lineageSegments);
  const sections = await getShopSectionsQuery(
    accountName,
    {
      objectType,
      name: parentName,
      path,
      sectionLimit: FAVORITES_SECTION_PREVIEW_LIMIT,
      ...filterQuery,
    },
    viewerUsername,
  );

  return (
    <FavoritesSections
      key={buildShopListScopeKey(objectType, lineageSegments, false, shopFilters)}
      accountName={accountName}
      objectType={objectType}
      initialSections={sections}
      lineageSegments={lineageSegments}
      navName={parentName}
      navPath={path}
      shopFilters={shopFilters}
      viewerUsername={viewerUsername}
    />
  );
}
