'use client';

import { useCallback, useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';
import { ObjectCard } from '@/modules/feed/presentation';
import { useInfiniteScroll, useSyncedPaginatedList } from '@/shared/presentation';
import { FeedColumn } from '@/shared/presentation/layout';

import { loadMoreFavoritesObjectsAction } from '@/app/(app)/user-profile/[name]/favorites-feed.actions';

import {
  profileShopFiltersActive,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import type { ShopObjectsPage } from '../../domain/types/shop-objects';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { FavoritesLoadMoreFooter } from './favorites-load-more-footer';
import { ProfileShopFilteredEmpty } from './profile-shop-filtered-empty';

export type FavoritesObjectListProps = {
  accountName: string;
  objectType: string;
  initialPage: ShopObjectsPage;
  /** Category lineage of a category type; empty for the type root and other types. */
  categoryPath: readonly string[];
  uncategorizedOnly?: boolean;
  shopFilters: ProfileShopFiltersState;
  viewerUsername?: string | null;
};

type ObjectRow = ShopObjectsPage['items'][number];

function appendUnique(prev: ObjectRow[], next: ObjectRow[]): ObjectRow[] {
  const seen = new Set(prev.map((row) => row.object_id));
  return [...prev, ...next.filter((row) => !seen.has(row.object_id))];
}

/** Favorites objects of one type (weight order) with cursor-based infinite scroll. */
export function FavoritesObjectList({
  accountName,
  objectType,
  initialPage,
  categoryPath,
  uncategorizedOnly = false,
  shopFilters,
  viewerUsername,
}: FavoritesObjectListProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const { items, setItems, cursor, setCursor, hasMore, setHasMore } =
    useSyncedPaginatedList(initialPage);
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  const onLoadMore = useCallback(() => {
    if (!hasMore || !cursor || pending) {
      return;
    }
    setLoadError(false);
    startTransition(async () => {
      try {
        const result = await loadMoreFavoritesObjectsAction(accountName, {
          objectType,
          categoryPath: [...categoryPath],
          uncategorizedOnly,
          tags: shopFilters.tags,
          rating: shopFilters.rating,
          cursor,
        });
        if (!result.ok) {
          setLoadError(true);
          return;
        }
        setItems((prev) => appendUnique(prev, result.value.items));
        setCursor(result.value.cursor);
        setHasMore(result.value.hasMore);
      } catch {
        setLoadError(true);
      }
    });
  }, [
    accountName,
    categoryPath,
    cursor,
    hasMore,
    objectType,
    pending,
    setCursor,
    setHasMore,
    setItems,
    shopFilters.rating,
    shopFilters.tags,
    uncategorizedOnly,
  ]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: hasMore && !loadError,
    isLoading: pending,
    onLoadMore,
  });

  if (items.length === 0) {
    if (profileShopFiltersActive(shopFilters)) {
      return <ProfileShopFilteredEmpty />;
    }
    const inCategory = uncategorizedOnly || categoryPath.length > 0;
    return (
      <section
        className="rounded-card border border-border bg-surface/80 p-card-padding"
        aria-labelledby="favorites-objects-empty"
      >
        <h2
          id="favorites-objects-empty"
          className="text-body-lg font-weight-strong font-display text-fg"
        >
          {formatFavoritesTypeLabel(objectType)}
        </h2>
        <p className="mt-2 text-body-sm text-muted">
          {inCategory ? t('profile_shop_empty_category') : t('favorites_empty')}
        </p>
      </section>
    );
  }

  return (
    <FeedColumn>
      <ul className="flex flex-col gap-card-padding">
        {items.map((o) => (
          <ObjectCard
            key={o.object_id}
            object={o}
            viewerUsername={viewerUsername}
            onRequireLogin={openLogin}
          />
        ))}
      </ul>
      <FavoritesLoadMoreFooter
        hasMore={hasMore}
        pending={pending}
        loadError={loadError}
        sentinelRef={sentinelRef}
        onLoadMore={onLoadMore}
        loadMoreLabel={t('profile_shop_load_more')}
      />
    </FeedColumn>
  );
}
