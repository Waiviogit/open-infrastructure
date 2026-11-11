'use client';

import { useId } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronDownIcon } from '@/icons';
import { PROFILE_RAIL_STICKY_CLASS } from '@/shared/presentation/layout';

import { buildFavoritesPath, parseFavoritesPath } from '../../domain/favorites-path';
import type { CategoryNavData } from '../../domain/types/category-nav';
import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import { CategoryNavChrome } from './category-nav-chrome';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { FAVORITES_SIDE_RAIL_OFFSET_CLASS } from './favorites-layout-classes';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { UserProfileNavLink } from './user-profile-nav-link';

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

/**
 * Accordion of the user's Favorites types. Only the active type is expanded; a category type
 * shows its category nav under it. The active type follows the optimistic pathname, and the
 * nav shows a skeleton until the server catches up with a newly picked type.
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
  const panelIdPrefix = useId();
  const { pathname } = useEffectiveProfileNav();
  const effectivePath = parseFavoritesPath(pathname);
  const activeType = effectivePath
    ? (effectivePath.objectType ?? items[0]?.objectType ?? null)
    : serverObjectType;
  const effectiveLineage = effectivePath?.lineage ?? lineageSegments;

  return (
    <nav
      aria-label={t('favorites')}
      className={[
        PROFILE_RAIL_STICKY_CLASS,
        FAVORITES_SIDE_RAIL_OFFSET_CLASS,
        'rounded-card border border-border bg-surface/60 p-card-padding',
      ].join(' ')}
    >
      {items.length === 0 ? (
        <p className="text-body-sm text-muted">{t('favorites_types_empty')}</p>
      ) : (
        <ul className="flex list-none flex-col gap-1 p-0">
          {items.map(({ objectType, objectsCount, hasCategories }) => {
            const isActive = objectType === activeType;
            const expandable = hasCategories;
            const expanded = expandable && isActive;
            const panelId = `${panelIdPrefix}-${objectType}`;
            const isServerType = objectType === serverObjectType;
            return (
              <li key={objectType}>
                <UserProfileNavLink
                  href={buildFavoritesPath(accountName, objectType)}
                  className={[
                    'flex items-center justify-between gap-2 rounded-btn px-2 py-1.5 text-body-sm hover:bg-surface-control hover:text-fg',
                    isActive ? 'bg-surface-control font-weight-label text-fg' : 'text-muted',
                  ].join(' ')}
                  aria-current={
                    isActive ? (effectiveLineage.length === 0 ? 'page' : 'true') : undefined
                  }
                  aria-expanded={expandable ? expanded : undefined}
                  aria-controls={expanded ? panelId : undefined}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="truncate">{formatFavoritesTypeLabel(objectType)}</span>
                    {expandable ? (
                      <ChevronDownIcon
                        size={12}
                        className={[
                          'shrink-0 text-fg-secondary transition-transform duration-150',
                          expanded ? '' : '-rotate-90',
                        ].join(' ')}
                      />
                    ) : null}
                  </span>
                  {objectsCount != null ? (
                    <span className="shrink-0 text-caption tabular-nums text-fg-secondary">
                      {objectsCount}
                    </span>
                  ) : null}
                </UserProfileNavLink>
                {expanded ? (
                  <div id={panelId} className="ms-3 mt-1 border-s border-border ps-2">
                    {!isServerType ? (
                      <CategoryNavPendingSkeleton />
                    ) : navData === null ? (
                      <p className="py-1 text-body-sm text-muted">
                        {t('profile_categories_unavailable')}
                      </p>
                    ) : (
                      <CategoryNavChrome
                        data={navData}
                        accountName={accountName}
                        objectType={objectType}
                        lineageSegments={lineageSegments}
                        navLineage={navLineage}
                      />
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
