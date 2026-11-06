'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ObjectActivityFeedList } from '@/modules/messaging/presentation/object-activity-feed-list';

import { loadMoreHomeActivityFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import type { HomeActivityFeedPage } from '../../application/dto/home-followed-feeds.dto';
import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedEmptyState } from './home-feed-empty-state';

type HomeActivityFeedListProps = {
  initialPage: HomeActivityFeedPage;
  currentUsername: string;
};

/** Read-only: replies and edits happen on the object's own activity tab ("From …" link). */
export function HomeActivityFeedList({ initialPage, currentUsername }: HomeActivityFeedListProps) {
  const { t } = useI18n();
  const { items, pending, sentinelRef } = useHomeFeedPages(
    initialPage,
    loadMoreHomeActivityFeedAction,
  );

  if (items.length === 0) {
    return <HomeFeedEmptyState message={t('home_feed_activity_empty')} />;
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
