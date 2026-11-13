'use client';

import { useCallback } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ObjectActivityFeedList } from '@/modules/messaging/presentation/object-activity-feed-list';

import { loadMoreHomeActivityFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import type { HomeActivityFeedPage } from '../../application/dto/home-followed-feeds.dto';
import type { HomeFeedFilter } from '../../domain/home-feed-filter';
import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedEmptyState } from './home-feed-empty-state';

type HomeActivityFeedListProps = {
  initialPage: HomeActivityFeedPage;
  currentUsername: string | null;
  /** Rail filter the first page was loaded with; next pages use the same one. */
  filter: HomeFeedFilter;
};

const messageKey = (item: HomeActivityFeedPage['items'][number]) => item.message_id;

/** Read-only: replies and edits happen on the object's own activity tab ("From …" link). */
export function HomeActivityFeedList({
  initialPage,
  currentUsername,
  filter,
}: HomeActivityFeedListProps) {
  const { t } = useI18n();
  const loadMore = useCallback(
    (cursor: string) => loadMoreHomeActivityFeedAction(filter, cursor),
    [filter],
  );
  const { items, pending, sentinelRef } = useHomeFeedPages(initialPage, loadMore, messageKey);

  if (items.length === 0) {
    return (
      <HomeFeedEmptyState
        message={t(filter.kind === 'my' ? 'home_feed_activity_empty' : 'home_feed_filter_empty')}
      />
    );
  }

  return (
    <ObjectActivityFeedList
      messages={items}
      viewerUsername={currentUsername}
      loadingMore={pending}
      sentinelRef={sentinelRef}
    />
  );
}
