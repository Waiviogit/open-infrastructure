'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CategoryNavList, CategoryNavUpLinks } from '@/shared/presentation/category-nav';

import {
  buildFavoritesPath,
  isUncategorizedLineage,
  parseFavoritesPath,
} from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  parseProfileShopFilters,
} from '../../domain/profile-shop-filters-url';
import type { CategoryNavData } from '../../domain/types/category-nav';
import { UNCATEGORIZED_SHOP_PATH_SEGMENT } from '../../domain/category-nav-path';
import { FavoritesNavLink } from './favorites-nav-links';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

export type CategoryNavChromeProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage of the server-rendered URL (drives ← Up / All categories). */
  lineageSegments: readonly string[];
  /** Lineage whose children `data.items` are (the parent of a leaf, the root for Uncategorized). */
  navLineage: readonly string[];
};

/**
 * Category navigation of one Favorites type: ← Up / All categories, child categories (› when
 * they have children) and Uncategorized. Active state follows the optimistic pathname.
 */
export function CategoryNavChrome({
  data,
  accountName,
  objectType,
  lineageSegments,
  navLineage,
}: CategoryNavChromeProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { pathname } = useEffectiveProfileNav();
  const filters = useMemo(() => parseProfileShopFilters(searchParams), [searchParams]);
  const effectiveLineage = parseFavoritesPath(pathname)?.lineage ?? [...lineageSegments];
  const uncategorizedActive = isUncategorizedLineage(effectiveLineage);
  const activeName = uncategorizedActive
    ? null
    : (effectiveLineage[effectiveLineage.length - 1] ?? null);

  const hrefFor = (lineage: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters);
  const hasItems = data.items.length > 0;
  // Uncategorized only means something next to real categories; alone it would just repeat the type.
  const hasUncategorized = hasItems && data.uncategorized_count > 0;

  return (
    <>
      {lineageSegments.length > 0 ? (
        <CategoryNavUpLinks
          upHref={hrefFor(lineageSegments.slice(0, -1))}
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
        />
      ) : null}
      {hasUncategorized ? (
        // Divider on the wrapper: a top border on the rounded link would render as an arc.
        <div className="mt-2 border-t border-border pt-2">
          <FavoritesNavLink
            href={hrefFor([UNCATEGORIZED_SHOP_PATH_SEGMENT])}
            className={[
              'block rounded-btn px-2 py-1.5 text-body-sm underline-offset-2 hover:text-fg hover:underline',
              uncategorizedActive ? 'font-weight-label text-fg' : 'text-muted',
            ].join(' ')}
            aria-current={uncategorizedActive ? 'page' : undefined}
          >
            {t('profile_categories_uncategorized')}
          </FavoritesNavLink>
        </div>
      ) : null}
    </>
  );
}
