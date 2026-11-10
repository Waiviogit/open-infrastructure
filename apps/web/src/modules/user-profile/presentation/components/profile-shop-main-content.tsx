import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

import { getCategoryNav } from '../../infrastructure/clients/categories.client';
import { getShopObjectsQuery } from '../../application/queries/get-shop-objects.query';
import { getShopSectionsQuery } from '../../application/queries/get-shop-sections.query';
import type { ProfileShopFiltersState } from '../../domain/profile-shop-filters-url';
import {
  buildShopListScopeKey,
  profileShopFiltersActive,
} from '../../domain/profile-shop-filters-url';
import { apiNavContextFromLineage, UNCATEGORIZED_SHOP_PATH_SEGMENT } from './category-nav-path';
import { ProfileShopFilterChips } from './profile-shop-filter-chips';
import { ProfileShopFilteredEmpty } from './profile-shop-filtered-empty';
import { ShopObjectList } from './shop-object-list';
import { ShopSections, type ShopUncategorizedSection } from './shop-sections';

export type ProfileShopMainContentProps = {
  accountName: string;
  types: readonly string[];
  basePath: string;
  lineageSegments: string[];
  shopFilters?: ProfileShopFiltersState;
  sectionKey?: 'user-shop' | 'recipe';
};

const EMPTY_SHOP_FILTERS: ProfileShopFiltersState = { tags: [], rating: null };

/** Preview cards in the trailing Uncategorized section (matches query-api `SHOP_SECTION_OBJECTS_PER_CATEGORY`). */
const UNCATEGORIZED_PREVIEW_LIMIT = 3;

/**
 * Resolves category nav for the current URL; leaf routes render an infinite object list,
 * intermediate routes render section groups (child categories × preview objects).
 * The root view appends an Uncategorized section (objects without any category) after the last category.
 * Active tag/rating filters always use a flat object list so facet counts match visible rows.
 */
export async function ProfileShopMainContent({
  accountName,
  types,
  basePath,
  lineageSegments,
  shopFilters = EMPTY_SHOP_FILTERS,
  sectionKey = 'user-shop',
}: ProfileShopMainContentProps) {
  const auth = createCookieAuthContextProvider();
  const user = await auth.getUser();
  const viewerUsername = user?.username ?? null;
  const filterQuery = {
    tags: shopFilters.tags,
    rating: shopFilters.rating,
  };

  const chips = <ProfileShopFilterChips filters={shopFilters} />;

  const uncategorizedOnly =
    lineageSegments.length === 1 && lineageSegments[0] === UNCATEGORIZED_SHOP_PATH_SEGMENT;

  if (uncategorizedOnly || profileShopFiltersActive(shopFilters)) {
    const page = await getShopObjectsQuery(
      accountName,
      {
        types,
        categoryPath: uncategorizedOnly ? [] : lineageSegments,
        uncategorizedOnly,
        limit: 20,
        ...filterQuery,
      },
      viewerUsername,
    );

    return (
      <>
        {chips}
        {page.items.length === 0 && profileShopFiltersActive(shopFilters) ? (
          <ProfileShopFilteredEmpty />
        ) : (
          <ShopObjectList
            key={buildShopListScopeKey(lineageSegments, uncategorizedOnly, shopFilters)}
            accountName={accountName}
            initialPage={page}
            types={types}
            categoryPath={uncategorizedOnly ? [] : lineageSegments}
            uncategorizedOnly={uncategorizedOnly}
            shopFilters={shopFilters}
            viewerUsername={viewerUsername}
            sectionKey={sectionKey}
          />
        )}
      </>
    );
  }

  const { parentName, path } = apiNavContextFromLineage(lineageSegments);
  const nav = await getCategoryNav(accountName, types, {
    name: parentName,
    path,
  });
  const isLeaf = nav === null || nav.items.length === 0;

  if (isLeaf) {
    const page = await getShopObjectsQuery(
      accountName,
      {
        types,
        categoryPath: lineageSegments,
        limit: 20,
        ...filterQuery,
      },
      viewerUsername,
    );

    return (
      <>
        {chips}
        <ShopObjectList
          key={buildShopListScopeKey(lineageSegments, false, shopFilters)}
          accountName={accountName}
          initialPage={page}
          types={types}
          categoryPath={lineageSegments}
          shopFilters={shopFilters}
          viewerUsername={viewerUsername}
          sectionKey={sectionKey}
        />
      </>
    );
  }

  const showUncategorized = lineageSegments.length === 0 && nav.uncategorized_count > 0;
  const [sections, uncategorizedPage] = await Promise.all([
    getShopSectionsQuery(
      accountName,
      {
        types,
        name: parentName,
        path,
        sectionLimit: 3,
        ...filterQuery,
      },
      viewerUsername,
    ),
    showUncategorized
      ? getShopObjectsQuery(
          accountName,
          {
            types,
            categoryPath: [],
            uncategorizedOnly: true,
            limit: UNCATEGORIZED_PREVIEW_LIMIT,
          },
          viewerUsername,
        )
      : null,
  ]);
  const uncategorizedSection: ShopUncategorizedSection | null =
    uncategorizedPage && uncategorizedPage.items.length > 0
      ? { items: uncategorizedPage.items, totalObjects: nav.uncategorized_count }
      : null;

  return (
    <>
      {chips}
      <ShopSections
        key={buildShopListScopeKey(lineageSegments, false, shopFilters)}
        accountName={accountName}
        initialSections={sections}
        types={types}
        basePath={basePath}
        lineageSegments={lineageSegments}
        navName={parentName}
        navPath={path}
        uncategorizedSection={uncategorizedSection}
        shopFilters={shopFilters}
        viewerUsername={viewerUsername}
        sectionKey={sectionKey}
      />
    </>
  );
}
