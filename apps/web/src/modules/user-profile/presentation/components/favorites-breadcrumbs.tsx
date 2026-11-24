'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CategoryBreadcrumbs, type CategoryCrumb } from '@/shared/presentation/category-nav';

import { buildFavoritesPath, isUncategorizedLineage } from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import { useFavoritesCategoryDrawerState } from './favorites-category-drawer';
import { FavoritesNavLink } from './favorites-nav-links';

export type FavoritesBreadcrumbsProps = {
  accountName: string;
  objectType: string;
  /** Decoded category segments after the type (`['uncategorized']` for the Uncategorized node). */
  lineage: readonly string[];
  /** Active `tags` / `rating`; every link keeps them. */
  filters: ProfileShopFiltersState;
  /** Type has categories: below `lg` the current crumb opens the category drawer. */
  categoryMenu?: boolean;
  /** Below `lg`, controls on the same row after the trail (the Filter button on a bare type page). */
  trailing?: ReactNode;
};

/**
 * `All › Category › Subcategory` trail above the Favorites center column. The root crumb is the
 * active type's root, labelled `All` (the type itself is selected in the type menu above).
 */
export function FavoritesBreadcrumbs({
  accountName,
  objectType,
  lineage,
  filters,
  categoryMenu = false,
  trailing,
}: FavoritesBreadcrumbsProps) {
  const { t } = useI18n();
  const drawer = useFavoritesCategoryDrawerState();
  const hrefFor = (segments: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, segments), filters);

  const crumbs: CategoryCrumb[] = [{ key: 'type', label: t('all'), href: hrefFor([]) }];
  if (isUncategorizedLineage(lineage)) {
    crumbs.push({
      key: 'uncategorized',
      label: t('profile_categories_uncategorized'),
      href: hrefFor(lineage),
    });
  } else {
    lineage.forEach((segment, index) => {
      crumbs.push({
        key: `category-${index}`,
        label: segment,
        href: hrefFor(lineage.slice(0, index + 1)),
      });
    });
  }

  return (
    <CategoryBreadcrumbs
      crumbs={crumbs}
      NavLink={FavoritesNavLink}
      menu={
        categoryMenu && drawer
          ? { open: drawer.open, onOpen: drawer.openDrawer, ariaLabel: t('favorites_categories_aria') }
          : null
      }
      trailing={trailing}
    />
  );
}
