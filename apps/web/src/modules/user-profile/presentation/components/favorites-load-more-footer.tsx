'use client';

import type { RefObject } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

export type FavoritesLoadMoreFooterProps = {
  hasMore: boolean;
  pending: boolean;
  loadError: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  /** Accessible name of the keyboard fallback button. */
  loadMoreLabel: string;
};

/**
 * Infinite-scroll tail of a Favorites feed: sentinel + sr-only keyboard fallback; an inline
 * alert with a retry button when the last page failed (auto-loading pauses until retry).
 */
export function FavoritesLoadMoreFooter({
  hasMore,
  pending,
  loadError,
  sentinelRef,
  onLoadMore,
  loadMoreLabel,
}: FavoritesLoadMoreFooterProps) {
  const { t } = useI18n();

  if (!hasMore) {
    return null;
  }

  if (loadError) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2" role="alert">
        <p className="text-body-sm text-error">{t('favorites_load_more_error')}</p>
        <button type="button" className="text-caption text-link underline" onClick={onLoadMore}>
          {t('profile_filters_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <button type="button" className="sr-only" disabled={pending} onClick={onLoadMore}>
        {loadMoreLabel}
      </button>
    </div>
  );
}
