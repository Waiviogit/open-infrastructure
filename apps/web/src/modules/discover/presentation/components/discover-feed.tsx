'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { MobileFilterButton } from '@/shared/presentation';
import type { CategoryHrefFor } from '@/shared/presentation/category-nav';

import type { DiscoverBox, DiscoverMapView } from '../../domain/discover-url';
import { DiscoverActiveChips } from './discover-active-chips';
import { DiscoverCategoryBreadcrumbs } from './discover-category-nav';
import { DiscoverMapPanel } from './discover-map-panel';
import {
  DiscoverMobileHeader,
  type DiscoverMobileTab,
} from './discover-mobile-header';
import { DiscoverObjectFeed } from './discover-object-feed';
import { DiscoverSections } from './discover-sections';
import { DiscoverSortSelect } from './discover-sort-select';
import { DiscoverUserFeed } from './discover-user-feed';

export type DiscoverFeedProps = {
  usersMode: boolean;
  objectType: string | null;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  /** Category lineage, root first (kept by every Discover link and fetch). */
  categoryPath: string[];
  map: DiscoverMapView | null;
  mapView: DiscoverMapView | null;
  viewerUsername?: string | null;
  onRequireLogin?: () => void;
  showFilters: boolean;
  showMap: boolean;
  mobileTab: DiscoverMobileTab;
  onMobileTabChange: (tab: DiscoverMobileTab) => void;
  onOpenFilterSheet: () => void;
  /** The type has a category tree: breadcrumbs, and below `lg` the crumb opens the drawer. */
  categoryTrail: DiscoverCategoryTrail | null;
  /**
   * Center column: `sections` = one block per subcategory (a category with subcategories, no
   * filters); `pending` = that is not known yet (category tree loading); `feed` = flat object feed.
   */
  centerMode: DiscoverCenterMode;
  onApplyMapArea: (box: DiscoverBox) => void;
  onMapViewChange?: (view: DiscoverMapView) => void;
  onExpandMap: () => void;
};

export type DiscoverCenterMode = 'feed' | 'sections' | 'pending';

export type DiscoverCategoryTrail = {
  hrefFor: CategoryHrefFor;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
};

export function DiscoverFeed({
  usersMode,
  objectType,
  q,
  tags,
  sort,
  box,
  categoryPath,
  map,
  mapView,
  viewerUsername,
  onRequireLogin,
  showFilters,
  showMap,
  mobileTab,
  onMobileTabChange,
  onOpenFilterSheet,
  categoryTrail,
  centerMode,
  onApplyMapArea,
  onMapViewChange,
  onExpandMap,
}: DiscoverFeedProps) {
  const { t } = useI18n();

  const mapObjectType =
    showMap && objectType && objectType !== 'all' ? objectType : null;

  const showMobileMap = mobileTab === 'map' && mapObjectType != null;

  const filterButton = showFilters ? (
    <span className="shrink-0 lg:hidden">
      <MobileFilterButton onClick={onOpenFilterSheet} />
    </span>
  ) : null;
  const filtersActive = q.trim().length > 0 || tags.length > 0 || box != null;
  // Like Favorites: below `lg` the Filter button shares the crumb row at the type root without
  // filters; with a category path or active filters it moves after the chips.
  const singleRowToolbar =
    categoryTrail != null && categoryPath.length === 0 && !filtersActive;

  return (
    <main className="min-w-0">
      <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
        <h1 className="text-heading font-weight-label text-fg">
          {t('discover_page_title')}
        </h1>
        {!usersMode && centerMode === 'feed' ? (
          <DiscoverSortSelect
            usersMode={usersMode}
            objectType={objectType}
            q={q}
            tags={tags}
            sort={sort}
            box={box}
            categoryPath={categoryPath}
            map={map}
          />
        ) : null}
      </div>

      {categoryTrail ? (
        <DiscoverCategoryBreadcrumbs
          categoryPath={categoryPath}
          hrefFor={categoryTrail.hrefFor}
          drawer={{
            open: categoryTrail.drawerOpen,
            onOpen: categoryTrail.onOpenDrawer,
          }}
          trailing={singleRowToolbar ? filterButton : null}
        />
      ) : null}

      <DiscoverActiveChips
        usersMode={usersMode}
        objectType={objectType}
        q={q}
        tags={tags}
        sort={sort}
        box={box}
        categoryPath={categoryPath}
        map={map}
        filterButton={singleRowToolbar ? null : filterButton}
      />

      <DiscoverMobileHeader
        usersMode={usersMode}
        objectType={objectType}
        q={q}
        tags={tags}
        sort={sort}
        box={box}
        categoryPath={categoryPath}
        map={map}
        showMap={showMap}
        showSort={centerMode === 'feed'}
        mobileTab={mobileTab}
        onMobileTabChange={onMobileTabChange}
      />

      {usersMode ? (
        <DiscoverUserFeed q={q} />
      ) : objectType ? (
        <>
          {showMobileMap ? (
            <div className="lg:hidden">
              <DiscoverMapPanel
                variant="feed"
                objectType={mapObjectType}
                q={q}
                tags={tags}
                sort={sort}
                box={box}
                categoryPath={categoryPath}
                mapView={mapView}
                onApplyArea={onApplyMapArea}
                onViewChange={onMapViewChange}
                onExpand={onExpandMap}
              />
            </div>
          ) : null}
          <div className={showMobileMap ? 'hidden lg:block' : undefined}>
            {centerMode === 'sections' && categoryTrail ? (
              <DiscoverSections
                objectType={objectType}
                categoryPath={categoryPath}
                hrefFor={categoryTrail.hrefFor}
                viewerUsername={viewerUsername}
                onRequireLogin={onRequireLogin}
              />
            ) : centerMode === 'pending' ? (
              <div className="flex flex-col gap-card-padding" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-card border border-border bg-surface-control"
                    aria-hidden
                  />
                ))}
              </div>
            ) : (
              <DiscoverObjectFeed
                objectType={objectType}
                q={q}
                tags={tags}
                sort={sort}
                box={box}
                categoryPath={categoryPath}
                viewerUsername={viewerUsername}
                onRequireLogin={onRequireLogin}
                hideType={objectType !== 'all'}
              />
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}
