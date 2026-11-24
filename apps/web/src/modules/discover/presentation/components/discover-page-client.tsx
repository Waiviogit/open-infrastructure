'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { objectTypeSupportsCategories } from '@opden-data-layer/core/object-type-registry';

import {
  OptimisticNavSync,
  useEffectiveNav,
  useInstantNavigation,
} from '@/shared/presentation';
import { useLoginModal } from '@/modules/auth';
import { sameCategoryLineage } from '@/shared/domain/category-nav';

import {
  parseDiscoverPageState,
  buildDiscoverHref,
  type DiscoverBox,
  type DiscoverMapView,
} from '../../domain/discover-url';
import {
  objectTypeHasTagCategoryFilters,
  objectTypeSupportsGeo,
} from '../../domain/discover-registry';
import { resolveInitialDiscoverType } from '../../domain/resolve-initial-discover-type';
import { useDiscoverCategoryNav } from '../hooks/use-discover-category-nav';
import { DiscoverCategoryDrawer, DiscoverCategoryRail } from './discover-category-nav';
import { DiscoverFeed, type DiscoverCenterMode } from './discover-feed';
import type { DiscoverMobileTab } from './discover-mobile-header';
import { DiscoverFilters } from './discover-filters';
import { DiscoverFilterSheet } from './discover-filter-sheet';
import { DiscoverMapModal } from './discover-map-modal';
import { DiscoverMapRail } from './discover-map-rail';
import { ObjectPageCenterSkeleton } from '@/modules/object/presentation/components/object-page-loading-skeleton';

export type DiscoverPageClientProps = {
  viewerUsername?: string | null;
  rememberedObjectType?: string | null;
};

function DiscoverPageContent({
  viewerUsername = null,
  rememberedObjectType = null,
}: DiscoverPageClientProps) {
  const searchParams = useSearchParams();
  const { isNavigating, navigateInstant } = useInstantNavigation();
  const {
    usersMode,
    objectType,
    q,
    tags,
    sort,
    box,
    map: mapFromUrl,
    categoryPath,
  } = useMemo(() => parseDiscoverPageState(searchParams), [searchParams]);
  const effectiveNav = useEffectiveNav();
  const activeCategoryPath = useMemo(
    () => parseDiscoverPageState(new URLSearchParams(effectiveNav.search)).categoryPath,
    [effectiveNav.search],
  );
  const { openLogin } = useLoginModal();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [lastMapView, setLastMapView] = useState<DiscoverMapView | null>(null);
  const [mobileTab, setMobileTab] = useState<DiscoverMobileTab>('list');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mapFromUrl) {
      setLastMapView(mapFromUrl);
    }
  }, [mapFromUrl]);

  const effectiveMapView = lastMapView ?? mapFromUrl;

  useEffect(() => {
    setMounted(true);
  }, []);

  const showFilters =
    !usersMode && objectType != null && objectTypeHasTagCategoryFilters(objectType);

  const showMap = !usersMode && objectTypeSupportsGeo(objectType);

  useEffect(() => {
    if (!showMap && mobileTab === 'map') {
      setMobileTab('list');
    }
  }, [showMap, mobileTab]);

  useEffect(() => {
    if (!mounted || usersMode || objectType != null) {
      return;
    }

    const resolution = resolveInitialDiscoverType({
      objectType,
      usersMode,
      remembered: rememberedObjectType,
    });

    if (resolution.action === 'navigate') {
      const href = buildDiscoverHref({
        type: resolution.type,
        q,
        tags,
        sort,
        box,
        map: mapFromUrl,
      });
      navigateInstant({ href, method: 'replace', scroll: false });
    }
  }, [
    mounted,
    objectType,
    usersMode,
    rememberedObjectType,
    q,
    tags,
    sort,
    box,
    mapFromUrl,
    navigateInstant,
  ]);

  const filterObjectType =
    objectType && objectType !== 'all' ? objectType : null;

  const categoryType =
    filterObjectType && objectTypeSupportsCategories(filterObjectType) ? filterObjectType : null;
  const categoryNav = useDiscoverCategoryNav({
    objectType: categoryType,
    categoryPath,
    q,
    tags,
    box,
  });
  // While the root level loads the tree is assumed (skeleton); an empty root hides it.
  const showCategoryTree =
    categoryType != null &&
    (categoryPath.length > 0 || categoryNav.status !== 'ready' || categoryNav.items.length > 0);

  const filtersActive = q.trim().length > 0 || tags.length > 0 || box != null;
  // Blocks per subcategory inside a category that has subcategories, without filters (like
  // Favorites); the type root and leaves keep the flat feed.
  const centerMode: DiscoverCenterMode =
    categoryType == null || categoryPath.length === 0 || filtersActive
      ? 'feed'
      : categoryNav.status === 'loading'
        ? 'pending'
        : categoryNav.status === 'ready' &&
            categoryNav.items.length > 0 &&
            sameCategoryLineage(categoryNav.navLineage, categoryPath)
          ? 'sections'
          : 'feed';

  const categoryHref = useCallback(
    (lineage: readonly string[]) =>
      buildDiscoverHref({
        type: objectType ?? undefined,
        categoryPath: lineage,
        q,
        tags,
        sort,
        box,
        map: mapFromUrl ?? undefined,
      }),
    [objectType, q, tags, sort, box, mapFromUrl],
  );

  const mapObjectType = showMap && objectType ? objectType : null;

  const applyMapArea = useCallback(
    (nextBox: DiscoverBox) => {
      if (!objectType) {
        return;
      }
      const href = buildDiscoverHref({
        type: objectType,
        categoryPath,
        q,
        tags,
        sort,
        box: nextBox,
        map: effectiveMapView ?? undefined,
      });
      navigateInstant({ href, method: 'replace', scroll: false });
    },
    [navigateInstant, objectType, categoryPath, q, tags, sort, effectiveMapView],
  );

  const handleMapViewChange = useCallback((view: DiscoverMapView) => {
    setLastMapView(view);
  }, []);

  const openMapModal = useCallback(() => {
    if (objectType && effectiveMapView) {
      navigateInstant({
        href: buildDiscoverHref({
          type: objectType,
          categoryPath,
          q,
          tags,
          sort,
          box,
          map: effectiveMapView,
        }),
        method: 'replace',
        scroll: false,
      });
    }
    setMapModalOpen(true);
  }, [navigateInstant, objectType, categoryPath, q, tags, sort, box, effectiveMapView]);

  return (
    <div className="mx-auto w-full max-w-container-page px-1 pt-section-y-sm max-lg:-mx-gutter max-lg:w-[calc(100%+2*var(--spacing-gutter))] sm:max-lg:-mx-gutter-sm sm:max-lg:w-[calc(100%+2*var(--spacing-gutter-sm))] lg:px-gutter">
      <div className="grid items-start gap-card-padding lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]">
        {/* Categories of the active type (types are in the hub's Discover band). */}
        <aside className="hidden min-w-0 lg:block">
          {showCategoryTree && categoryType ? (
            <DiscoverCategoryRail
              objectType={categoryType}
              nav={categoryNav}
              categoryPath={categoryPath}
              activeLineage={activeCategoryPath}
              hrefFor={categoryHref}
            />
          ) : null}
        </aside>
        <div className="relative z-10 min-w-0">
          {isNavigating ? (
            <div className="mb-4" aria-busy="true" aria-live="polite">
              <ObjectPageCenterSkeleton />
            </div>
          ) : null}
          <DiscoverFeed
            usersMode={usersMode}
            objectType={objectType}
            q={q}
            tags={tags}
            sort={sort}
            box={box}
            categoryPath={categoryPath}
            map={mapFromUrl}
            mapView={effectiveMapView}
            viewerUsername={viewerUsername}
            onRequireLogin={openLogin}
            showFilters={showFilters}
            showMap={showMap}
            mobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            onOpenFilterSheet={() => setFilterSheetOpen(true)}
            centerMode={centerMode}
            categoryTrail={
              showCategoryTree
                ? {
                    hrefFor: categoryHref,
                    drawerOpen: categoryDrawerOpen,
                    onOpenDrawer: () => setCategoryDrawerOpen(true),
                  }
                : null
            }
            onApplyMapArea={applyMapArea}
            onMapViewChange={handleMapViewChange}
            onExpandMap={openMapModal}
          />
        </div>
        {showMap || showFilters ? (
          <aside className="relative z-0 hidden min-w-0 self-start lg:sticky lg:top-[calc(var(--shell-header-height)+var(--hub-section-nav-height,0px)+var(--spacing-card))] lg:block lg:max-h-[calc(100dvh-var(--shell-header-height)-var(--hub-section-nav-height,0px)-2*var(--spacing-card))] lg:overflow-y-auto">
            {mapObjectType ? (
              <DiscoverMapRail
                objectType={mapObjectType}
                q={q}
                tags={tags}
                sort={sort}
                box={box}
                categoryPath={categoryPath}
                mapView={effectiveMapView}
                onApplyArea={applyMapArea}
                onViewChange={mapModalOpen ? undefined : handleMapViewChange}
                onExpand={openMapModal}
              />
            ) : null}
            {showFilters && filterObjectType ? (
              <DiscoverFilters
                objectType={filterObjectType}
                q={q}
                tags={tags}
                sort={sort}
                box={box}
                categoryPath={categoryPath}
                map={mapFromUrl}
              />
            ) : null}
          </aside>
        ) : (
          <div className="hidden min-w-0 self-start lg:block" aria-hidden />
        )}
      </div>

      {showCategoryTree && categoryType ? (
        <DiscoverCategoryDrawer
          open={categoryDrawerOpen}
          onClose={() => setCategoryDrawerOpen(false)}
          objectType={categoryType}
          nav={categoryNav}
          activeLineage={activeCategoryPath}
          hrefFor={categoryHref}
        />
      ) : null}

      {filterSheetOpen && filterObjectType ? (
        <DiscoverFilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          objectType={filterObjectType}
          q={q}
          tags={tags}
          sort={sort}
          box={box}
          categoryPath={categoryPath}
          map={mapFromUrl}
        />
      ) : null}

      {mapObjectType ? (
        <DiscoverMapModal
          open={mapModalOpen}
          onClose={() => setMapModalOpen(false)}
          objectType={mapObjectType}
          q={q}
          tags={tags}
          sort={sort}
          box={box}
          categoryPath={categoryPath}
          mapView={effectiveMapView}
          onApplyArea={applyMapArea}
          onViewChange={handleMapViewChange}
        />
      ) : null}
    </div>
  );
}

export function DiscoverPageClient(props: DiscoverPageClientProps) {
  return (
    <>
      <OptimisticNavSync />
      <DiscoverPageContent {...props} />
    </>
  );
}
