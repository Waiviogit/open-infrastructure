'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { buildFavoritesPath, isUncategorizedLineage } from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import { FAVORITES_CRUMBS_ROW_CLASS } from './favorites-layout-classes';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { UserProfileNavLink } from './user-profile-nav-link';

export type FavoritesBreadcrumbsProps = {
  accountName: string;
  objectType: string;
  /** Decoded category segments after the type (`['uncategorized']` for the Uncategorized node). */
  lineage: readonly string[];
  /** Active `tags` / `rating`; every link keeps them. */
  filters: ProfileShopFiltersState;
};

type Crumb = { key: string; label: string; path: string };

/**
 * `Type › Category › Subcategory` trail above the Favorites center column. Every crumb but the
 * last links back (filters kept); the last one is the current page.
 */
export function FavoritesBreadcrumbs({
  accountName,
  objectType,
  lineage,
  filters,
}: FavoritesBreadcrumbsProps) {
  const { t } = useI18n();

  const crumbs: Crumb[] = [
    {
      key: 'type',
      label: formatFavoritesTypeLabel(objectType),
      path: buildFavoritesPath(accountName, objectType),
    },
  ];
  if (isUncategorizedLineage(lineage)) {
    crumbs.push({
      key: 'uncategorized',
      label: t('profile_categories_uncategorized'),
      path: buildFavoritesPath(accountName, objectType, lineage),
    });
  } else {
    lineage.forEach((segment, index) => {
      crumbs.push({
        key: `category-${index}`,
        label: segment,
        path: buildFavoritesPath(accountName, objectType, lineage.slice(0, index + 1)),
      });
    });
  }

  return (
    <nav aria-label={t('favorites_breadcrumb_aria')} className={FAVORITES_CRUMBS_ROW_CLASS}>
      <ol className="flex min-w-0 list-none flex-nowrap items-center gap-x-2 overflow-hidden p-0 text-body-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.key} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-fg-tertiary">
                  ›
                </span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate font-weight-label text-fg">
                  {crumb.label}
                </span>
              ) : (
                <UserProfileNavLink
                  href={buildProfileShopHref(crumb.path, filters)}
                  className="truncate text-fg-secondary underline-offset-2 hover:text-fg hover:underline"
                >
                  {crumb.label}
                </UserProfileNavLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
