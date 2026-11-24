'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon } from '@/icons';
import {
  CategoryNavDrawerList as SharedCategoryNavDrawerList,
  categoryDrawerRowClass,
} from '@/shared/presentation/category-nav';

import { UNCATEGORIZED_SHOP_PATH_SEGMENT } from '../../domain/category-nav-path';
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
import { FavoritesDrawerNavLink } from './favorites-nav-links';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

export type CategoryNavDrawerListProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage whose children `data.items` are (the parent of a leaf, the root for Uncategorized). */
  navLineage: readonly string[];
  /** Closes the drawer: picking a leaf, the level itself or Uncategorized ends the browse. */
  onPick: () => void;
};

/**
 * Favorites category drawer (shared drawer list) plus Uncategorized at the type root. Links use
 * `replace`: they take the place of the drawer's Back entry (`useCloseOnHistoryBack`).
 */
export function CategoryNavDrawerList({
  data,
  accountName,
  objectType,
  navLineage,
  onPick,
}: CategoryNavDrawerListProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { pathname } = useEffectiveProfileNav();
  const filters = useMemo(() => parseProfileShopFilters(searchParams), [searchParams]);
  const effectiveLineage = parseFavoritesPath(pathname)?.lineage ?? [...navLineage];
  const uncategorizedActive = isUncategorizedLineage(effectiveLineage);

  const hrefFor = (lineage: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters);
  const showUncategorized =
    navLineage.length === 0 && data.items.length > 0 && data.uncategorized_count > 0;

  return (
    <SharedCategoryNavDrawerList
      items={data.items}
      navLineage={navLineage}
      activeLineage={uncategorizedActive ? [UNCATEGORIZED_SHOP_PATH_SEGMENT] : effectiveLineage}
      rootLabel={formatFavoritesTypeLabel(objectType)}
      hrefFor={hrefFor}
      NavLink={FavoritesDrawerNavLink}
      onPick={onPick}
      extraRows={
        showUncategorized ? (
          <li>
            <FavoritesDrawerNavLink
              href={hrefFor([UNCATEGORIZED_SHOP_PATH_SEGMENT])}
              className={categoryDrawerRowClass(uncategorizedActive)}
              aria-current={uncategorizedActive ? 'page' : undefined}
              onClick={onPick}
            >
              <span className="min-w-0 truncate">{t('profile_categories_uncategorized')}</span>
              {uncategorizedActive ? <CheckIcon size={18} className="shrink-0" /> : null}
            </FavoritesDrawerNavLink>
          </li>
        ) : null
      }
    />
  );
}
