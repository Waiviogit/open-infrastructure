'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { profileSectionTabClass } from '@/shared/presentation';

import type { DiscoverBox, DiscoverMapView } from '../../domain/discover-url';
import { DiscoverSortSelect } from './discover-sort-select';

export type DiscoverMobileTab = 'list' | 'map';

export type DiscoverMobileHeaderProps = {
  usersMode: boolean;
  objectType: string | null;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  /** Category lineage, root first (kept by every Discover link and fetch). */
  categoryPath: string[];
  map: DiscoverMapView | null;
  showMap: boolean;
  /** False in category block mode (blocks are ordered by count, not by the sort). */
  showSort?: boolean;
  mobileTab: DiscoverMobileTab;
  onMobileTabChange: (tab: DiscoverMobileTab) => void;
};

/**
 * Below `lg`, under the filter chips: the List / Map switch (geo types) and the sort. Types are
 * picked in the hub's Discover band, filters through the Filter pill next to the chips.
 */
export function DiscoverMobileHeader({
  usersMode,
  objectType,
  q,
  tags,
  sort,
  box,
  categoryPath,
  map,
  showMap,
  showSort: sortAllowed = true,
  mobileTab,
  onMobileTabChange,
}: DiscoverMobileHeaderProps) {
  const { t } = useI18n();

  const showSort =
    sortAllowed && !usersMode && objectType != null && (!showMap || mobileTab === 'list');

  if (!showMap && !showSort) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3 lg:hidden">
      {showMap ? (
        <nav
          aria-label={t('discover_map_view_nav_aria')}
          className="flex flex-nowrap items-end gap-x-2 border-b border-border"
        >
          <button
            type="button"
            className={profileSectionTabClass(mobileTab === 'list', 'sub')}
            onClick={() => onMobileTabChange('list')}
          >
            {t('object_list_tab')}
          </button>
          <button
            type="button"
            className={profileSectionTabClass(mobileTab === 'map', 'sub')}
            onClick={() => onMobileTabChange('map')}
          >
            {t('discover_map')}
          </button>
        </nav>
      ) : null}

      {showSort ? (
        <div className="flex justify-end">
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
        </div>
      ) : null}
    </div>
  );
}
