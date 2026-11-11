import { notFound } from 'next/navigation';

import { isUserFavoritesObjectType } from '@opden-data-layer/core/constants';

import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

import { getFavoritesTypesQuery } from '../../application/queries/get-favorites.query';
import { getShopObjectsQuery } from '../../application/queries/get-shop-objects.query';
import { apiNavContextFromLineage } from '../../domain/category-nav-path';
import { isUncategorizedLineage } from '../../domain/favorites-path';
import {
  buildShopListScopeKey,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import { favoritesTypeHasCategories } from '../../domain/types/favorites';
import { FAVORITES_OBJECTS_PAGE_SIZE } from '../../domain/types/shop-objects';
import { getCategoryNav } from '../../infrastructure/clients/categories.client';
import { FavoritesBreadcrumbs } from './favorites-breadcrumbs';
import { FavoritesCategoryContent } from './favorites-category-content';
import { FavoritesEmptyMain } from './favorites-empty-main';
import { FavoritesMobileNav } from './favorites-mobile-nav';
import { FavoritesObjectList } from './favorites-object-list';
import { ProfileShopFilterChips } from './profile-shop-filter-chips';

export type ProfileFavoritesMainContentProps = {
  accountName: string;
  /** From the URL segment; omitted on bare `/@name/favorites` (first type is shown). */
  routeObjectType?: string;
  /** Decoded category segments after the type. */
  lineageSegments?: readonly string[];
  shopFilters: ProfileShopFiltersState;
};

/**
 * Center column of the Favorites tab: breadcrumbs, the mobile type/category nav, filter chips,
 * then category sections or a flat list of the active type.
 * Unknown types and a category lineage on a type without categorized objects are not found.
 */
export async function ProfileFavoritesMainContent({
  accountName,
  routeObjectType,
  lineageSegments = [],
  shopFilters,
}: ProfileFavoritesMainContentProps) {
  const routeType = routeObjectType?.trim();
  if (routeType !== undefined) {
    if (!isUserFavoritesObjectType(routeType)) {
      notFound();
    }
  }

  const [user, typesView] = await Promise.all([
    createCookieAuthContextProvider().getUser(),
    getFavoritesTypesQuery(accountName),
  ]);
  const viewerUsername = user?.username ?? null;
  const objectType = routeType ?? typesView.types[0];

  if (!objectType) {
    return <FavoritesEmptyMain />;
  }

  // Category navigation only once the type has categorized objects; a category path otherwise 404s.
  const withCategories = favoritesTypeHasCategories(typesView.items, objectType);
  if (!withCategories && lineageSegments.length > 0) {
    notFound();
  }
  const uncategorizedOnly = withCategories && isUncategorizedLineage(lineageSegments);
  const nav = withCategories
    ? await getCategoryNav(
        accountName,
        objectType,
        apiNavContextFromLineage(uncategorizedOnly ? [] : lineageSegments),
      )
    : null;

  return (
    <>
      <FavoritesBreadcrumbs
        accountName={accountName}
        objectType={objectType}
        lineage={lineageSegments}
        filters={shopFilters}
      />
      <FavoritesMobileNav
        accountName={accountName}
        items={typesView.items}
        objectType={objectType}
        lineage={lineageSegments}
        navData={nav}
        filters={shopFilters}
      />
      <ProfileShopFilterChips filters={shopFilters} />
      {withCategories ? (
        <FavoritesCategoryContent
          accountName={accountName}
          objectType={objectType}
          lineageSegments={lineageSegments}
          uncategorizedOnly={uncategorizedOnly}
          nav={nav}
          shopFilters={shopFilters}
          viewerUsername={viewerUsername}
        />
      ) : (
        <FavoritesFlatContent
          accountName={accountName}
          objectType={objectType}
          shopFilters={shopFilters}
          viewerUsername={viewerUsername}
        />
      )}
    </>
  );
}

type FavoritesFlatContentProps = {
  accountName: string;
  objectType: string;
  shopFilters: ProfileShopFiltersState;
  viewerUsername: string | null;
};

/** A type without categories: one weight-ordered list with tag/rating filters. */
async function FavoritesFlatContent({
  accountName,
  objectType,
  shopFilters,
  viewerUsername,
}: FavoritesFlatContentProps) {
  const page = await getShopObjectsQuery(
    accountName,
    {
      objectType,
      categoryPath: [],
      limit: FAVORITES_OBJECTS_PAGE_SIZE,
      tags: shopFilters.tags,
      rating: shopFilters.rating,
    },
    viewerUsername,
  );

  return (
    <FavoritesObjectList
      key={buildShopListScopeKey(objectType, [], false, shopFilters)}
      accountName={accountName}
      objectType={objectType}
      initialPage={page}
      categoryPath={[]}
      shopFilters={shopFilters}
      viewerUsername={viewerUsername}
    />
  );
}
