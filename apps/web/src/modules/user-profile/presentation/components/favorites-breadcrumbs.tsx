'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CategoryBreadcrumbs, type CategoryCrumb } from '@/shared/presentation/category-nav';

import { buildFavoritesPath } from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import { useFavoritesCategoryDrawerState } from './favorites-category-drawer';
import { FavoritesNavLink } from './favorites-nav-links';

export type FavoritesBreadcrumbsProps = {
  accountName: string;
  objectType: string;
  /** Category lineage (decoded segments after the type). */
  lineage: readonly string[];
  /** Adds the `Other` crumb after the lineage. */
  other?: boolean;
  /** Active `tags` / `rating`; every link keeps them. */
  filters: ProfileShopFiltersState;
  /** Type has categories: below `lg` the current crumb opens the category drawer. */
  categoryMenu?: boolean;
  /** Below `lg`, controls on the same row after the trail (the Filter button on a bare type page). */
  trailing?: ReactNode;
};

/**
 * `All › Category › Subcategory` (`› Other` for the Other category) trail above the Favorites
 * center column. The root crumb is the active type's root, labelled `All` (the type itself is
 * selected in the type menu above).
 */
export function FavoritesBreadcrumbs({
  accountName,
  objectType,
  lineage,
  other = false,
  filters,
  categoryMenu = false,
  trailing,
}: FavoritesBreadcrumbsProps) {
  const { t } = useI18n();
  const drawer = useFavoritesCategoryDrawerState();
  const hrefFor = (segments: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, segments), filters);

  const crumbs: CategoryCrumb[] = [
    { key: 'type', label: t('all'), href: hrefFor([]) },
    ...lineage.map((segment, index) => ({
      key: `category-${index}`,
      label: segment,
      href: hrefFor(lineage.slice(0, index + 1)),
    })),
  ];
  if (other) {
    crumbs.push({
      key: 'other',
      label: t('category_other'),
      href: buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters, true),
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
