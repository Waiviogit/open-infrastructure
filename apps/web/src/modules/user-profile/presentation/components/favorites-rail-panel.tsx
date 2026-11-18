'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { parseFavoritesPath } from '../../domain/favorites-path';
import type { CategoryNavData } from '../../domain/types/category-nav';
import {
  favoritesTypeHasCategories,
  type FavoritesTypeSummary,
} from '../../domain/types/favorites';
import { CategoryNavChrome } from './category-nav-chrome';
import { CategoryNavDrawerList } from './category-nav-drawer-list';
import { useFavoritesCategoryDrawerScope } from './favorites-category-drawer';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import {
  FAVORITES_LEFT_RAIL_CARD_CLASS,
  FAVORITES_LEFT_RAIL_FLOW_CLASS,
} from './favorites-layout-classes';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

const CATEGORY_NAV_SKELETON_ROWS = 4;

export type FavoritesRailPanelProps = {
  accountName: string;
  items: readonly FavoritesTypeSummary[];
  /** Type the server rendered `navData` for (URL type, or the first type on bare `/favorites`). */
  serverObjectType: string | null;
  /** Lineage of the server-rendered URL. */
  lineageSegments: readonly string[];
  /** Category nav of `serverObjectType`; null for other types or when unavailable. */
  navData: CategoryNavData | null;
  /** Lineage whose children `navData.items` are. */
  navLineage: readonly string[];
};

function CategoryNavPendingSkeleton() {
  return (
    <ul className="list-none space-y-1 p-0" aria-hidden>
      {Array.from({ length: CATEGORY_NAV_SKELETON_ROWS }, (_, i) => (
        <li key={i}>
          <div className="h-7 w-full animate-pulse rounded-btn bg-surface-control" />
        </li>
      ))}
    </ul>
  );
}

function sameLineage(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

/**
 * Left rail of the Favorites tab: the category navigation of the active type. Types live in the
 * horizontal submenu; a type without categories leaves the rail empty. The active type follows
 * the optimistic pathname, and the nav shows a skeleton until the server catches up with a newly
 * picked type.
 *
 * Inside the mobile category drawer it renders `CategoryNavDrawerList` (one level at a time) and
 * also shows the skeleton while a newly opened category level loads.
 */
export function FavoritesRailPanel({
  accountName,
  items,
  serverObjectType,
  lineageSegments,
  navData,
  navLineage,
}: FavoritesRailPanelProps) {
  const { t } = useI18n();
  const drawer = useFavoritesCategoryDrawerScope();
  const { pathname } = useEffectiveProfileNav();
  const effectivePath = parseFavoritesPath(pathname);
  const activeType = effectivePath
    ? (effectivePath.objectType ?? items[0]?.objectType ?? null)
    : serverObjectType;

  if (activeType === null || !favoritesTypeHasCategories(items, activeType)) {
    return null;
  }

  if (drawer) {
    const pending =
      activeType !== serverObjectType ||
      (effectivePath !== null && !sameLineage(effectivePath.lineage, lineageSegments));
    return (
      <nav aria-label={t('favorites_categories_aria')} className="px-3 pb-gutter pt-3">
        {pending ? (
          <CategoryNavPendingSkeleton />
        ) : navData === null ? (
          <p className="px-2 py-1 text-body-sm text-muted">{t('profile_categories_unavailable')}</p>
        ) : (
          <CategoryNavDrawerList
            data={navData}
            accountName={accountName}
            objectType={activeType}
            navLineage={navLineage}
            onPick={drawer.close}
          />
        )}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t('favorites_categories_aria')}
      className={[FAVORITES_LEFT_RAIL_FLOW_CLASS, FAVORITES_LEFT_RAIL_CARD_CLASS].join(' ')}
    >
      <p className="mb-2 truncate font-weight-label text-body-sm text-fg">
        {formatFavoritesTypeLabel(activeType)}
      </p>
      {activeType !== serverObjectType ? (
        <CategoryNavPendingSkeleton />
      ) : navData === null ? (
        <p className="py-1 text-body-sm text-muted">{t('profile_categories_unavailable')}</p>
      ) : (
        <CategoryNavChrome
          data={navData}
          accountName={accountName}
          objectType={activeType}
          lineageSegments={lineageSegments}
          navLineage={navLineage}
        />
      )}
    </nav>
  );
}
