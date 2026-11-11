'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { UNCATEGORIZED_SHOP_PATH_SEGMENT } from '../../domain/category-nav-path';
import {
  buildFavoritesPath,
  isUncategorizedLineage,
  parseFavoritesPath,
} from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import type { CategoryNavData } from '../../domain/types/category-nav';
import {
  favoritesTypeHasCategories,
  type FavoritesTypeSummary,
} from '../../domain/types/favorites';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { UserProfileNavLink } from './user-profile-nav-link';

export type FavoritesMobileNavProps = {
  accountName: string;
  items: readonly FavoritesTypeSummary[];
  /** Type rendered by the server. */
  objectType: string;
  /** Decoded lineage rendered by the server. */
  lineage: readonly string[];
  /** Category nav at `lineage` (type root for Uncategorized); null for other types. */
  navData: CategoryNavData | null;
  filters: ProfileShopFiltersState;
};

function chipClass(active: boolean): string {
  return [
    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-3 py-1 text-body-sm',
    active
      ? 'border-accent font-weight-label text-accent'
      : 'border-border bg-surface-control text-fg-secondary hover:text-fg',
  ].join(' ');
}

const CHIP_ROW_CLASS = 'scrollbar-minimal flex list-none gap-2 overflow-x-auto p-0 pb-1';

/**
 * Mobile replacement of the Favorites left rail (hidden from `lg`): a scrollable row of type
 * chips, plus child-category and Uncategorized chips for a category type.
 */
export function FavoritesMobileNav({
  accountName,
  items,
  objectType,
  lineage,
  navData,
  filters,
}: FavoritesMobileNavProps) {
  const { t } = useI18n();
  const { pathname } = useEffectiveProfileNav();
  const effectivePath = parseFavoritesPath(pathname);
  const activeType = effectivePath?.objectType ?? objectType;
  const effectiveLineage = effectivePath?.lineage ?? lineage;
  const uncategorizedActive = isUncategorizedLineage(effectiveLineage);
  const activeName = effectiveLineage[effectiveLineage.length - 1] ?? null;

  const navLineage = isUncategorizedLineage(lineage) ? [] : lineage;
  const showCategories =
    navData !== null &&
    activeType === objectType &&
    favoritesTypeHasCategories(items, objectType);
  const showUncategorized =
    showCategories &&
    navLineage.length === 0 &&
    navData.items.length > 0 &&
    navData.uncategorized_count > 0;
  const hasCategoryRow = showCategories && (navData.items.length > 0 || showUncategorized);

  if (items.length <= 1 && !hasCategoryRow) {
    return null;
  }

  return (
    <nav aria-label={t('favorites_mobile_nav_aria')} className="mb-card-padding space-y-2 lg:hidden">
      {items.length > 1 ? (
        <ul className={CHIP_ROW_CLASS}>
          {items.map((item) => {
            const active = item.objectType === activeType;
            return (
              <li key={item.objectType}>
                <UserProfileNavLink
                  href={buildFavoritesPath(accountName, item.objectType)}
                  className={chipClass(active)}
                  aria-current={active ? 'true' : undefined}
                >
                  {formatFavoritesTypeLabel(item.objectType)}
                  {item.objectsCount != null ? (
                    <span className="text-caption tabular-nums">{item.objectsCount}</span>
                  ) : null}
                </UserProfileNavLink>
              </li>
            );
          })}
        </ul>
      ) : null}
      {hasCategoryRow ? (
        <ul className={CHIP_ROW_CLASS}>
          {navData.items.map((item) => {
            const active = !uncategorizedActive && activeName === item.name;
            return (
              <li key={item.name}>
                <UserProfileNavLink
                  href={buildProfileShopHref(
                    buildFavoritesPath(accountName, objectType, [...navLineage, item.name]),
                    filters,
                  )}
                  className={chipClass(active)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.name}
                  {item.has_children ? <span aria-hidden>›</span> : null}
                </UserProfileNavLink>
              </li>
            );
          })}
          {showUncategorized ? (
            <li>
              <UserProfileNavLink
                href={buildProfileShopHref(
                  buildFavoritesPath(accountName, objectType, [UNCATEGORIZED_SHOP_PATH_SEGMENT]),
                  filters,
                )}
                className={chipClass(uncategorizedActive)}
                aria-current={uncategorizedActive ? 'page' : undefined}
              >
                {t('profile_categories_uncategorized')}
              </UserProfileNavLink>
            </li>
          ) : null}
        </ul>
      ) : null}
    </nav>
  );
}
