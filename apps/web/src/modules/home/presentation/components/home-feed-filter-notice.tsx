'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { HomeFeedFilter, HomeFeedFilterNoticeKind as Notice } from '../../domain/home-feed-filter';

type HomeFeedFilterNoticeProps = {
  notice: Notice | null;
  requested: HomeFeedFilter | null;
};

const SORT_LABEL_KEYS = {
  trending: 'home_feed_filter_trending',
  hot: 'home_feed_filter_hot',
  new: 'home_feed_filter_new',
} as const;

/** Explains why the feed shows another filter than the URL asks for. */
export function HomeFeedFilterNotice({ notice, requested }: HomeFeedFilterNoticeProps) {
  const { t } = useI18n();
  if (!notice) {
    return null;
  }

  const message =
    notice === 'sort_unavailable' && requested && requested.kind in SORT_LABEL_KEYS
      ? t('home_feed_filter_sort_unavailable').replace(
          '{sort}',
          t(SORT_LABEL_KEYS[requested.kind as keyof typeof SORT_LABEL_KEYS]),
        )
      : t('home_feed_filter_signin_required');

  return (
    <p
      role="status"
      className="mb-card-padding rounded-card border border-border bg-surface px-card-padding py-2 text-body-sm text-fg-secondary"
    >
      {message}
    </p>
  );
}
