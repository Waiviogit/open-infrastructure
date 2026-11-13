'use client';

import { useCallback, useTransition } from 'react';

import { useInfiniteScroll, useSyncedPaginatedList } from '@/shared/presentation';

import { appendUniqueFeedItems } from '../../domain/append-unique-feed-items';

export type HomeFeedPage<TItem> = {
  items: TItem[];
  cursor: string | null;
  hasMore: boolean;
};

/**
 * RSC-seeded cursor list with infinite scroll for hub feed tabs.
 * `loadMore` is a server action bound to the list's rail filter; it returns an empty page
 * on failure, never throws. Lists are keyed by filter, so a filter change remounts them.
 */
export function useHomeFeedPages<TItem>(
  initialPage: HomeFeedPage<TItem>,
  loadMore: (cursor: string) => Promise<HomeFeedPage<TItem>>,
  getKey: (item: TItem) => string,
) {
  const { items, setItems, cursor, setCursor, hasMore, setHasMore } =
    useSyncedPaginatedList(initialPage);
  const [pending, startTransition] = useTransition();

  const onLoadMore = useCallback(() => {
    if (!cursor || pending) {
      return;
    }
    startTransition(async () => {
      const next = await loadMore(cursor);
      setItems((prev) => appendUniqueFeedItems(prev, next.items, getKey));
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    });
  }, [cursor, getKey, loadMore, pending, setCursor, setHasMore, setItems]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: pending,
    onLoadMore,
  });

  return { items, hasMore, pending, canLoadMore: cursor != null, onLoadMore, sentinelRef };
}
