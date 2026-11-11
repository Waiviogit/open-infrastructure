'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';

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
import { CategoryNavList } from './category-nav-list';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { UserProfileNavLink } from './user-profile-nav-link';

export type CategoryNavChromeProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage of the server-rendered URL (drives ← Up / All categories). */
  lineageSegments: readonly string[];
  /** Lineage whose children `data.items` are (the parent of a leaf, the root for Uncategorized). */
  navLineage: readonly string[];
};

const NAV_TEXT_LINK_CLASS = 'text-muted underline-offset-2 hover:text-fg hover:underline';

/**
 * Category navigation of one category type: ← Up / All categories, child categories (› when
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

  const rootPath = buildFavoritesPath(accountName, objectType);
  const upPath = buildFavoritesPath(accountName, objectType, lineageSegments.slice(0, -1));
  const hasItems = data.items.length > 0;
  // Uncategorized only means something next to real categories; alone it would just repeat the type.
  const hasUncategorized = hasItems && data.uncategorized_count > 0;

  return (
    <>
      {lineageSegments.length > 0 ? (
        <p className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-caption">
          <UserProfileNavLink
            href={buildProfileShopHref(upPath, filters)}
            className={NAV_TEXT_LINK_CLASS}
          >
            {t('profile_categories_up')}
          </UserProfileNavLink>
          <UserProfileNavLink
            href={buildProfileShopHref(rootPath, filters)}
            className={NAV_TEXT_LINK_CLASS}
          >
            {t('profile_categories_all')}
          </UserProfileNavLink>
        </p>
      ) : null}
      {hasItems ? (
        <CategoryNavList
          items={data.items}
          accountName={accountName}
          objectType={objectType}
          parentLineage={navLineage}
          activeName={activeName}
          filters={filters}
        />
      ) : null}
      {hasUncategorized ? (
        // Divider on the wrapper: a top border on the rounded link would render as an arc.
        <div className="mt-2 border-t border-border pt-2">
          <UserProfileNavLink
            href={buildProfileShopHref(
              buildFavoritesPath(accountName, objectType, [UNCATEGORIZED_SHOP_PATH_SEGMENT]),
              filters,
            )}
            className={[
              'block rounded-btn px-2 py-1.5 text-body-sm underline-offset-2 hover:text-fg hover:underline',
              uncategorizedActive ? 'font-weight-label text-fg' : 'text-muted',
            ].join(' ')}
            aria-current={uncategorizedActive ? 'page' : undefined}
          >
            {t('profile_categories_uncategorized')}
          </UserProfileNavLink>
        </div>
      ) : null}
    </>
  );
}
