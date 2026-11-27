'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useInfiniteScroll, useSyncedPaginatedList } from '@/shared/presentation';

import type { WaivSwap, WaivSwapsPage } from '../../domain/waiv-token.types';
import { fetchWaivSwapsClient } from '../../infrastructure/clients/waiv-token.browser.client';
import { WaivSwapRow } from './waiv-swap-row';

type WaivSwapsFeedProps = {
  /** First page from the server, or null when it failed. */
  initialPage: WaivSwapsPage | null;
};

const EMPTY_PAGE: WaivSwapsPage = { items: [], cursor: null, hasMore: false };

/** `/waiv/swaps`: every account's WAIV pool swaps, newest first, loaded on scroll. */
export function WaivSwapsFeed({ initialPage }: WaivSwapsFeedProps) {
  const { t } = useI18n();
  const initial = useMemo(() => initialPage ?? EMPTY_PAGE, [initialPage]);
  const { items, hasMore, cursor, setItems, setHasMore, setCursor } =
    useSyncedPaginatedList<WaivSwap>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialPage === null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const result = await fetchWaivSwapsClient(cursor, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    setLoading(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setItems((previous) => {
      const seen = new Set(previous.map((item) => item.id));
      return [...previous, ...result.data.items.filter((item) => !seen.has(item.id))];
    });
    setCursor(result.data.cursor);
    setHasMore(result.data.hasMore);
  }, [cursor, hasMore, loading, setCursor, setHasMore, setItems]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: hasMore && !failed,
    isLoading: loading,
    onLoadMore: () => void loadMore(),
  });

  if (initialPage === null && items.length === 0) {
    return (
      <p role="alert" className="rounded-card border border-border bg-surface p-card-padding text-body-sm text-error">
        {t('waiv_page_swaps_error')}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface p-card-padding text-body-sm text-muted">
        {t('waiv_page_swaps_empty')}
      </p>
    );
  }

  return (
    <div className="min-w-0 rounded-card border border-border bg-surface px-card-padding">
      <ul aria-label={t('waiv_page_swaps_aria')} aria-busy={loading}>
        {items.map((swap) => (
          <WaivSwapRow key={swap.id} swap={swap} />
        ))}
      </ul>

      {failed ? (
        <div role="alert" className="flex items-center justify-between gap-3 py-3 text-body-sm text-error">
          {t('waiv_page_swaps_error')}
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-btn border border-border px-3 py-1 text-body-sm text-fg hover:bg-surface-control"
          >
            {t('waiv_page_retry')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3 py-3" aria-hidden>
          <div className="h-10 animate-pulse rounded-card bg-surface-control" />
          <div className="h-10 animate-pulse rounded-card bg-surface-control" />
        </div>
      ) : null}

      {hasMore && !failed ? (
        <>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          <button type="button" className="sr-only" onClick={() => void loadMore()}>
            {t('load_more')}
          </button>
        </>
      ) : null}
    </div>
  );
}
