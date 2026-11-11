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
import { FavoritesSections, type FavoritesUncategorizedSection } from './favorites-sections';

export type FavoritesCategoryContentProps = {
  accountName: string;
  /** A type that supports the `category` update. */
  objectType: string;
  /** Decoded category segments from the URL (`['uncategorized']` for the Uncategorized node). */
  lineageSegments: readonly string[];
  uncategorizedOnly: boolean;
  /** Category nav at `lineageSegments` (the type root for Uncategorized); null when unavailable. */
  nav: CategoryNavData | null;
  shopFilters: ProfileShopFiltersState;
  viewerUsername: string | null;
};

/**
 * Center column of a category type. Three modes:
 * - Uncategorized node or active tag/rating filters → flat object list (facet counts match rows);
 * - leaf node (no child categories) → flat object list of the lineage;
 * - inner node → child category sections; the type root appends an Uncategorized section.
 */
export async function FavoritesCategoryContent({
  accountName,
  objectType,
  lineageSegments,
  uncategorizedOnly,
  nav,
  shopFilters,
  viewerUsername,
}: FavoritesCategoryContentProps) {
  const filterQuery = { tags: shopFilters.tags, rating: shopFilters.rating };
  const categoryPath = uncategorizedOnly ? [] : [...lineageSegments];
  const isLeaf = nav === null || nav.items.length === 0;

  if (uncategorizedOnly || profileShopFiltersActive(shopFilters) || isLeaf) {
    const page = await getShopObjectsQuery(
      accountName,
      {
        objectType,
        categoryPath,
        uncategorizedOnly: uncategorizedOnly ? true : undefined,
        limit: FAVORITES_OBJECTS_PAGE_SIZE,
        ...filterQuery,
      },
      viewerUsername,
    );

    return (
      <FavoritesObjectList
        key={buildShopListScopeKey(objectType, lineageSegments, uncategorizedOnly, shopFilters)}
        accountName={accountName}
        objectType={objectType}
        initialPage={page}
        categoryPath={categoryPath}
        uncategorizedOnly={uncategorizedOnly}
        shopFilters={shopFilters}
        viewerUsername={viewerUsername}
      />
    );
  }

  const { parentName, path } = apiNavContextFromLineage(lineageSegments);
  const showUncategorized = lineageSegments.length === 0 && nav.uncategorized_count > 0;
  const [sections, uncategorizedPage] = await Promise.all([
    getShopSectionsQuery(
      accountName,
      {
        objectType,
        name: parentName,
        path,
        sectionLimit: FAVORITES_SECTION_PREVIEW_LIMIT,
        ...filterQuery,
      },
      viewerUsername,
    ),
    showUncategorized
      ? getShopObjectsQuery(
          accountName,
          {
            objectType,
            categoryPath: [],
            uncategorizedOnly: true,
            limit: FAVORITES_SECTION_PREVIEW_LIMIT,
          },
          viewerUsername,
        )
      : null,
  ]);
  const uncategorizedSection: FavoritesUncategorizedSection | null =
    uncategorizedPage && uncategorizedPage.items.length > 0
      ? { items: uncategorizedPage.items, totalObjects: nav.uncategorized_count }
      : null;

  return (
    <FavoritesSections
      key={buildShopListScopeKey(objectType, lineageSegments, false, shopFilters)}
      accountName={accountName}
      objectType={objectType}
      initialSections={sections}
      lineageSegments={lineageSegments}
      navName={parentName}
      navPath={path}
      uncategorizedSection={uncategorizedSection}
      shopFilters={shopFilters}
      viewerUsername={viewerUsername}
    />
  );
}
