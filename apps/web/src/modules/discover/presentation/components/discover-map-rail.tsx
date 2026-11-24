'use client';

import type { DiscoverBox, DiscoverMapView } from '../../domain/discover-url';
import { DiscoverMapPanel } from './discover-map-panel';

export type DiscoverMapRailProps = {
  objectType: string;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  /** Category lineage, root first (kept by every Discover link and fetch). */
  categoryPath: string[];
  mapView: DiscoverMapView | null;
  onApplyArea: (box: DiscoverBox) => void;
  onViewChange?: (view: DiscoverMapView) => void;
  onExpand: () => void;
};

export function DiscoverMapRail({
  objectType,
  q,
  tags,
  sort,
  box,
  categoryPath,
  mapView,
  onApplyArea,
  onViewChange,
  onExpand,
}: DiscoverMapRailProps) {
  return (
    <section className="mb-4 overflow-hidden rounded-card border border-border bg-surface">
      <DiscoverMapPanel
        objectType={objectType}
        q={q}
        tags={tags}
        sort={sort}
        box={box}
        categoryPath={categoryPath}
        mapView={mapView}
        onApplyArea={onApplyArea}
        onViewChange={onViewChange}
        onExpand={onExpand}
      />
    </section>
  );
}
