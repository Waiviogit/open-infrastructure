'use client';

import { useCallback } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import { FeedList } from '@/modules/feed/presentation';
import { FeedColumn } from '@/shared/presentation/layout';

import { loadMoreHomeThreadsFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import type { HomeFeedFilter } from '../../domain/home-feed-filter';
import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedEmptyState } from './home-feed-empty-state';
import { HomeFeedLoadMore } from './home-feed-load-more';

type HomeThreadsFeedListProps = {
  initialPage: UserBlogFeedPage;
  currentUsername: string | null;
  /** Rail filter the first page was loaded with; next pages use the same one. */
  filter: HomeFeedFilter;
};

const storyKey = (item: UserBlogFeedPage['items'][number]) => item.id;

export function HomeThreadsFeedList({
  initialPage,
  currentUsername,
  filter,
}: HomeThreadsFeedListProps) {
  const { t } = useI18n();
  const loadMore = useCallback(
    (cursor: string) => loadMoreHomeThreadsFeedAction(filter, cursor),
    [filter],
  );
  const { items, hasMore, pending, canLoadMore, onLoadMore, sentinelRef } = useHomeFeedPages(
    initialPage,
    loadMore,
    storyKey,
  );

  if (items.length === 0) {
    return (
      <HomeFeedEmptyState
        message={t(filter.kind === 'my' ? 'home_feed_threads_empty' : 'home_feed_filter_empty')}
      />
    );
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
