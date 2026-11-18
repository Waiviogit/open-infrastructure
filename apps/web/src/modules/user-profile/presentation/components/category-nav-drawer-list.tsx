'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@/icons';

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
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { UserProfileNavLink } from './user-profile-nav-link';

export type CategoryNavDrawerListProps = {
  data: CategoryNavData;
  accountName: string;
  objectType: string;
  /** Lineage whose children `data.items` are (the parent of a leaf, the root for Uncategorized). */
  navLineage: readonly string[];
  /** Closes the drawer: picking a leaf, the level itself or Uncategorized ends the browse. */
  onPick: () => void;
};

function rowClass(active: boolean): string {
  return [
    'flex w-full min-w-0 items-center justify-between gap-2 rounded-btn px-2 py-3 text-body transition-colors',
    active ? 'bg-accent-soft font-weight-label text-accent' : 'text-fg hover:bg-ghost-surface',
  ].join(' ');
}

function sameLineage(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

/**
 * Category navigation of the mobile Favorites drawer, one level at a time: back to the parent
 * level, the level itself, its child categories and (at the type root) Uncategorized. A category
 * with children (›) opens it and keeps the drawer on its subcategories; any other pick closes it.
 * Links use `replace`: they take the place of the drawer's Back entry (`useCloseOnHistoryBack`).
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
  const levelActive = !uncategorizedActive && sameLineage(effectiveLineage, navLineage);
  const activeName =
    uncategorizedActive || levelActive ? null : (effectiveLineage[effectiveLineage.length - 1] ?? null);

  const typeLabel = formatFavoritesTypeLabel(objectType);
  const hrefFor = (lineage: readonly string[]) =>
    buildProfileShopHref(buildFavoritesPath(accountName, objectType, lineage), filters);
  const parentLineage = navLineage.slice(0, -1);
  const parentLabel = parentLineage[parentLineage.length - 1] ?? typeLabel;
  const levelLabel = navLineage[navLineage.length - 1] ?? typeLabel;
  const showUncategorized =
    navLineage.length === 0 && data.items.length > 0 && data.uncategorized_count > 0;

  return (
    <div className="flex flex-col gap-1">
      {navLineage.length > 0 ? (
        <UserProfileNavLink
          method="replace"
          href={hrefFor(parentLineage)}
          className="inline-flex min-w-0 items-center gap-1 self-start rounded-btn px-2 py-1.5 text-body-sm text-fg-secondary hover:bg-ghost-surface hover:text-fg"
        >
          <ChevronLeftIcon size={16} className="shrink-0" />
          <span className="min-w-0 truncate">{parentLabel}</span>
        </UserProfileNavLink>
      ) : null}

      <UserProfileNavLink
        method="replace"
        href={hrefFor(navLineage)}
        className={[
          'flex min-w-0 items-center justify-between gap-2 rounded-btn px-2 py-2 text-section font-weight-label',
          levelActive ? 'text-accent' : 'text-fg hover:bg-ghost-surface',
        ].join(' ')}
        aria-current={levelActive ? 'page' : undefined}
        onClick={onPick}
      >
        <span className="min-w-0 truncate">{levelLabel}</span>
        {levelActive ? <CheckIcon size={18} className="shrink-0" /> : null}
      </UserProfileNavLink>

      <ul className="list-none divide-y divide-border p-0">
        {data.items.map((item) => {
          const active = activeName === item.name;
          return (
            <li key={item.name}>
              <UserProfileNavLink
                method="replace"
                href={hrefFor([...navLineage, item.name])}
                className={rowClass(active)}
                aria-current={active ? 'page' : undefined}
                onClick={item.has_children ? undefined : onPick}
              >
                <span className="min-w-0 truncate">{item.name}</span>
                {item.has_children ? (
                  <ChevronRightIcon size={18} className="shrink-0 text-fg-tertiary" />
                ) : active ? (
                  <CheckIcon size={18} className="shrink-0" />
                ) : null}
              </UserProfileNavLink>
            </li>
          );
        })}
        {showUncategorized ? (
          <li>
            <UserProfileNavLink
              method="replace"
              href={hrefFor([UNCATEGORIZED_SHOP_PATH_SEGMENT])}
              className={rowClass(uncategorizedActive)}
              aria-current={uncategorizedActive ? 'page' : undefined}
              onClick={onPick}
            >
              <span className="min-w-0 truncate">{t('profile_categories_uncategorized')}</span>
              {uncategorizedActive ? <CheckIcon size={18} className="shrink-0" /> : null}
            </UserProfileNavLink>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
