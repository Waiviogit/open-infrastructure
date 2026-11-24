'use client';

import { useCallback, useMemo, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import {
  ActiveFilterChips,
  useInstantNavigation,
  type ActiveFilterChipItem,
} from '@/shared/presentation';

import {
  buildDiscoverHref,
  decodeTagFilter,
  type DiscoverBox,
  type DiscoverMapView,
} from '../../domain/discover-url';

export type DiscoverActiveChipsProps = {
  usersMode: boolean;
  objectType: string | null;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  /** Category lineage, root first (kept by every Discover link and fetch). */
  categoryPath: string[];
  /** The Other category of `categoryPath` (kept with it by every link and fetch). */
  categoryOther: boolean;
  map: DiscoverMapView | null;
  /** Below `lg`: the Filter button, after the chips (alone on its row when no filter is active). */
  filterButton?: ReactNode;
};

/** Active Discover filters (search, tags, map area) as {@link ActiveFilterChips}, like Favorites. */
export function DiscoverActiveChips({
  usersMode,
  objectType,
  q,
  tags,
  sort,
  box,
  categoryPath,
  categoryOther,
  map,
  filterButton,
}: DiscoverActiveChipsProps) {
  const { t } = useI18n();
  const { navigateInstant } = useInstantNavigation();
  const trimmedQ = q.trim();

  const pushHref = useCallback(
    (nextTags: string[], nextQ: string, nextBox: DiscoverBox | null) => {
      const href = buildDiscoverHref({
        users: usersMode,
        type: objectType ?? undefined,
        categoryPath,
        categoryOther,
        q: nextQ,
        tags: nextTags,
        sort,
        box: nextBox,
        map: map ?? undefined,
      });
      navigateInstant({ href, method: 'replace', scroll: false });
    },
    [navigateInstant, usersMode, objectType, categoryPath, categoryOther, sort, map],
  );

  const clearAll = useCallback(() => {
    pushHref([], '', null);
  }, [pushHref]);

  const items = useMemo((): ActiveFilterChipItem[] => {
    const chips: ActiveFilterChipItem[] = [];
    if (trimmedQ.length > 0) {
      chips.push({
        key: 'q',
        label: t('discover_active_search_chip', { query: trimmedQ }),
        removeLabel: t('discover_remove_search', { query: trimmedQ }),
        onRemove: () => pushHref(tags, '', box),
      });
    }
    for (const tag of tags) {
      const decoded = decodeTagFilter(tag);
      const label = decoded ? `${decoded.category}: ${decoded.value}` : tag;
      chips.push({
        key: `tag:${tag}`,
        label,
        removeLabel: t('discover_remove_filter', { tag: label }),
        onRemove: () =>
          pushHref(
            tags.filter((item) => item !== tag),
            q,
            box,
          ),
      });
    }
    if (box) {
      chips.push({
        key: 'box',
        label: t('discover_map_area_filter'),
        removeLabel: t('discover_remove_map_area'),
        onRemove: () => pushHref(tags, q, null),
      });
    }
    return chips;
  }, [trimmedQ, tags, box, q, pushHref, t]);

  return (
    <ActiveFilterChips
      items={items}
      onClearAll={clearAll}
      trailing={filterButton}
    />
  );
}
