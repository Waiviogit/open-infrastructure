'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { OptimisticNavSync, useInstantNavigation } from '@/shared/presentation';
import { useLoginModal } from '@/modules/auth';

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
import { DiscoverFeed } from './discover-feed';
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
  const { usersMode, objectType, q, tags, sort, box, map: mapFromUrl } = useMemo(
    () => parseDiscoverPageState(searchParams),
    [searchParams],
  );
  const { openLogin } = useLoginModal();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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

  const mapObjectType = showMap && objectType ? objectType : null;

  const applyMapArea = useCallback(
    (nextBox: DiscoverBox) => {
      if (!objectType) {
        return;
      }
      const href = buildDiscoverHref({
        type: objectType,
        q,
        tags,
        sort,
        box: nextBox,
        map: effectiveMapView ?? undefined,
      });
      navigateInstant({ href, method: 'replace', scroll: false });
    },
    [navigateInstant, objectType, q, tags, sort, effectiveMapView],
  );

  const handleMapViewChange = useCallback((view: DiscoverMapView) => {
    setLastMapView(view);
  }, []);

  const openMapModal = useCallback(() => {
    if (objectType && effectiveMapView) {
      navigateInstant({
        href: buildDiscoverHref({
          type: objectType,
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
  }, [navigateInstant, objectType, q, tags, sort, box, effectiveMapView]);

  return (
    <div className="mx-auto w-full max-w-container-page px-1 pt-section-y-sm max-lg:-mx-gutter max-lg:w-[calc(100%+2*var(--spacing-gutter))] sm:max-lg:-mx-gutter-sm sm:max-lg:w-[calc(100%+2*var(--spacing-gutter-sm))] lg:px-gutter">
      <div className="grid items-start gap-card-padding lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]">
        {/* Reserved for the active type's categories (types are in the hub's Discover band). */}
        <aside className="hidden min-w-0 lg:block" aria-hidden />
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
            map={mapFromUrl}
            mapView={effectiveMapView}
            viewerUsername={viewerUsername}
            onRequireLogin={openLogin}
            showFilters={showFilters}
            showMap={showMap}
            mobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            onOpenFilterSheet={() => setFilterSheetOpen(true)}
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
                map={mapFromUrl}
              />
            ) : null}
          </aside>
        ) : (
          <div className="hidden min-w-0 self-start lg:block" aria-hidden />
        )}
      </div>

      {filterSheetOpen && filterObjectType ? (
        <DiscoverFilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          objectType={filterObjectType}
          q={q}
          tags={tags}
          sort={sort}
          box={box}
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
