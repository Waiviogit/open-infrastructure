'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import { FeedList } from '@/modules/feed/presentation';
import { FeedColumn } from '@/shared/presentation/layout';

import { loadMoreHomeThreadsFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedEmptyState } from './home-feed-empty-state';
import { HomeFeedLoadMore } from './home-feed-load-more';

type HomeThreadsFeedListProps = {
  initialPage: UserBlogFeedPage;
  currentUsername: string;
};

export function HomeThreadsFeedList({ initialPage, currentUsername }: HomeThreadsFeedListProps) {
  const { t } = useI18n();
  const { items, hasMore, pending, canLoadMore, onLoadMore, sentinelRef } = useHomeFeedPages(
    initialPage,
    loadMoreHomeThreadsFeedAction,
  );

  if (items.length === 0) {
    return <HomeFeedEmptyState message={t('home_feed_threads_empty')} />;
  }

  return (
    <FeedColumn>
      <FeedList items={items} feedTab="threads" currentUsername={currentUsername} />
      {hasMore ? (
        <HomeFeedLoadMore
          sentinelRef={sentinelRef}
          pending={pending}
          canLoadMore={canLoadMore}
          onLoadMore={onLoadMore}
        />
      ) : null}
    </FeedColumn>
  );
}
