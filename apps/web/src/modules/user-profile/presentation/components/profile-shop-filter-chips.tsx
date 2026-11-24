'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, type ReactNode } from 'react';

import { decodeTagFilter } from '@/modules/discover/domain/discover-url';
import { useI18n } from '@/i18n/providers/i18n-provider';
import {
  ActiveFilterChips,
  useInstantNavigation,
  type ActiveFilterChipItem,
} from '@/shared/presentation';

import {
  buildProfileShopHref,
  parseProfileShopFilters,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import { shopRatingThresholdToStars } from '../../domain/profile-shop-registry';

export type ProfileShopFilterChipsProps = {
  filters: ProfileShopFiltersState;
  /** Below `lg`: the Filter button, after the chips (alone on its row when no filter is active). */
  filterButton?: ReactNode;
};

/** Active Favorites filters (rating, tags) as {@link ActiveFilterChips}. */
export function ProfileShopFilterChips({
  filters,
  filterButton,
}: ProfileShopFilterChipsProps) {
  const { t } = useI18n();
  const { navigateInstant } = useInstantNavigation();
  const pathname = usePathname();

  const pushFilters = useCallback(
    (next: ProfileShopFiltersState) => {
      const href = buildProfileShopHref(pathname, next);
      navigateInstant({ href, method: 'replace', scroll: false });
    },
    [navigateInstant, pathname],
  );

  const removeTag = useCallback(
    (tag: string) => {
      pushFilters({
        tags: filters.tags.filter((t) => t !== tag),
        rating: filters.rating,
      });
    },
    [pushFilters, filters.tags, filters.rating],
  );

  const removeRating = useCallback(() => {
    pushFilters({ tags: filters.tags, rating: null });
  }, [pushFilters, filters.tags]);

  const clearAll = useCallback(() => {
    pushFilters({ tags: [], rating: null });
  }, [pushFilters]);

  const items = useMemo((): ActiveFilterChipItem[] => {
    const chips: ActiveFilterChipItem[] = [];
    if (filters.rating != null) {
      chips.push({
        key: 'rating',
        label: t('profile_rating_filter_chip').replace(
          '{stars}',
          String(shopRatingThresholdToStars(filters.rating)),
        ),
        removeLabel: t('profile_remove_rating_filter'),
        onRemove: removeRating,
      });
    }
    for (const tag of filters.tags) {
      const decoded = decodeTagFilter(tag);
      const label = decoded ? `${decoded.category}: ${decoded.value}` : tag;
      chips.push({
        key: `tag:${tag}`,
        label,
        removeLabel: t('discover_remove_filter').replace('{tag}', label),
        onRemove: () => removeTag(tag),
      });
    }
    return chips;
  }, [filters.rating, filters.tags, removeRating, removeTag, t]);

  return (
    <ActiveFilterChips
      items={items}
      onClearAll={clearAll}
      trailing={filterButton}
    />
  );
}

export function ProfileShopFilterChipsFromUrl() {
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseProfileShopFilters(searchParams),
    [searchParams],
  );
  return <ProfileShopFilterChips filters={filters} />;
}
