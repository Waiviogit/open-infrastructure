'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  CategoryNavList,
  CategoryNavUpLinks,
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
import { FavoritesNavLink } from './favorites-nav-links';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

export type CategoryNavChromeProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage of the server-rendered URL (drives ← Up / All categories). */
  lineageSegments: readonly string[];
  /** Lineage whose children `data.items` are (the parent of a leaf). */
  navLineage: readonly string[];
};

/**
 * Category navigation of one Favorites type: ← Up / All categories, child categories (› when
 * they have children) and the level's Other category. Active state follows the optimistic URL.
 */
export function CategoryNavChrome({
  data,
  accountName,
  objectType,
  lineageSegments,
  navLineage,
}: CategoryNavChromeProps) {
  const searchParams = useSearchParams();
  const { pathname, search } = useEffectiveProfileNav();
  const filters = useMemo(() => parseProfileShopFilters(searchParams), [searchParams]);
  const urlView = resolveFavoritesCategoryView(lineageSegments, readFavoritesOtherParam(searchParams));
  const effectiveView = resolveFavoritesCategoryView(
    parseFavoritesPath(pathname)?.lineage ?? lineageSegments,
    readFavoritesOtherParam(new URLSearchParams(search)),
  );
  const activeName = effectiveView.lineage[effectiveView.lineage.length - 1] ?? null;

  const hrefFor = (lineage: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters);
  const hasItems = data.items.length > 0;
  // Other only means something next to real categories; alone it would repeat the level.
  const other =
    hasItems && data.other_count > 0
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
  // Other is one level below its category, like a leaf: Up goes to the category itself.
  const upLineage = urlView.other ? urlView.lineage : urlView.lineage.slice(0, -1);

  return (
    <>
      {urlView.lineage.length > 0 || urlView.other ? (
        <CategoryNavUpLinks
          upHref={hrefFor(upLineage)}
          allHref={hrefFor([])}
          NavLink={FavoritesNavLink}
        />
      ) : null}
      {hasItems ? (
        <CategoryNavList
          items={data.items}
          parentLineage={navLineage}
          activeName={activeName}
          hrefFor={hrefFor}
          NavLink={FavoritesNavLink}
          other={other}
        />
      ) : null}
    </>
  );
}
