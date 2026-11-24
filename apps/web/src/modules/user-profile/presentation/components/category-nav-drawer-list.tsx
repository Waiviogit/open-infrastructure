'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  CategoryNavDrawerList as SharedCategoryNavDrawerList,
  sameCategoryLineage,
} from '@/shared/presentation/category-nav';

import {
  buildFavoritesPath,
  parseFavoritesPath,
  readFavoritesOtherParam,
  resolveFavoritesCategoryView,
} from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  parseProfileShopFilters,
} from '../../domain/profile-shop-filters-url';
import type { CategoryNavData } from '../../domain/types/category-nav';
import { FavoritesDrawerNavLink } from './favorites-nav-links';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

export type CategoryNavDrawerListProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage whose children `data.items` are (the parent of a leaf). */
  navLineage: readonly string[];
  /** Closes the drawer: picking a leaf, the level itself or Other ends the browse. */
  onPick: () => void;
};

/**
 * Favorites category drawer (shared drawer list) with the level's Other category. Links use
 * `replace`: they take the place of the drawer's Back entry (`useCloseOnHistoryBack`).
 */
export function CategoryNavDrawerList({
  data,
  accountName,
  objectType,
  navLineage,
  onPick,
}: CategoryNavDrawerListProps) {
  const searchParams = useSearchParams();
  const { pathname, search } = useEffectiveProfileNav();
  const filters = useMemo(() => parseProfileShopFilters(searchParams), [searchParams]);
  const effectiveView = resolveFavoritesCategoryView(
    parseFavoritesPath(pathname)?.lineage ?? navLineage,
    readFavoritesOtherParam(new URLSearchParams(search)),
  );

  const hrefFor = (lineage: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters);
  const other =
    data.items.length > 0 && data.other_count > 0
      ? {
          count: data.other_count,
          href: buildProfileShopHref(
            buildFavoritesPath(accountName, objectType, navLineage),
            filters,
            true,
          ),
          active: effectiveView.other && sameCategoryLineage(effectiveView.lineage, navLineage),
        }
      : null;

  return (
    <SharedCategoryNavDrawerList
      items={data.items}
      navLineage={navLineage}
      activeLineage={effectiveView.lineage}
      rootLabel={formatFavoritesTypeLabel(objectType)}
      hrefFor={hrefFor}
      NavLink={FavoritesDrawerNavLink}
      onPick={onPick}
      other={other}
    />
  );
}
