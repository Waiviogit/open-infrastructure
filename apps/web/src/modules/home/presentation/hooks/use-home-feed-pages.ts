'use client';

import { useCallback, useTransition } from 'react';

import { useInfiniteScroll, useSyncedPaginatedList } from '@/shared/presentation';

export type HomeFeedPage<TItem> = {
  items: TItem[];
  cursor: string | null;
  hasMore: boolean;
};

/**
 * RSC-seeded cursor list with infinite scroll for hub feed tabs.
 * `loadMore` is a server action; it returns an empty page on failure, never throws.
 */
export function useHomeFeedPages<TItem>(
  initialPage: HomeFeedPage<TItem>,
  loadMore: (cursor: string) => Promise<HomeFeedPage<TItem>>,
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
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    });
  }, [cursor, loadMore, pending, setCursor, setHasMore, setItems]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: pending,
    onLoadMore,
  });

  return { items, hasMore, pending, canLoadMore: cursor != null, onLoadMore, sentinelRef };
}
