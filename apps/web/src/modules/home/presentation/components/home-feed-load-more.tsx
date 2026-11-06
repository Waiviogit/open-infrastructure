'use client';

import type { RefObject } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

type HomeFeedLoadMoreProps = {
  sentinelRef: RefObject<HTMLDivElement | null>;
  pending: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
};

/** Infinite-scroll sentinel with the keyboard fallback button and loading line. */
export function HomeFeedLoadMore({
  sentinelRef,
  pending,
  canLoadMore,
  onLoadMore,
}: HomeFeedLoadMoreProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <button
        type="button"
        className="sr-only"
        disabled={pending || !canLoadMore}
        onClick={onLoadMore}
      >
        {t('drafts_load_more')}
      </button>
      {pending ? (
        <p className="text-body-sm text-muted" aria-live="polite">
          {t('drafts_loading')}
        </p>
      ) : null}
    </div>
  );
}
