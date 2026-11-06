'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import { FeedList, FeedPostGrid } from '@/modules/feed/presentation';
import { FeedColumn } from '@/shared/presentation/layout';
import { shouldUsePostGrid, useShellMode } from '@/shell-mode';

import { loadMoreHomeFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedLoadMore } from './home-feed-load-more';

type HomeFeedPostsListProps = {
  initialPage: UserBlogFeedPage;
  currentUsername: string | null;
};

export function HomeFeedPostsList({
  initialPage,
  currentUsername,
}: HomeFeedPostsListProps) {
  const { t } = useI18n();
  const { resolvedMode } = useShellMode();
  const { items, hasMore, pending, canLoadMore, onLoadMore, sentinelRef } = useHomeFeedPages(
    initialPage,
    loadMoreHomeFeedAction,
  );
  const useInstagramGrid = shouldUsePostGrid(resolvedMode);

  if (items.length === 0) {
    return (
      <section
        className="rounded-card border border-border bg-surface/80 p-card-padding"
        aria-labelledby="home-feed-empty-title"
      >
        <h2
          id="home-feed-empty-title"
          className="font-display text-body-lg font-weight-strong text-fg"
        >
          {t('app_section_nav_home')}
        </h2>
        <p className="mt-2 text-body-sm text-muted">
          {currentUsername
            ? t('home_feed_empty_personalized')
            : t('home_feed_empty_global')}
        </p>
      </section>
    );
  }

  return (
    <FeedColumn>
      {useInstagramGrid ? (
        <FeedPostGrid items={items} />
      ) : (
        <FeedList items={items} feedTab="posts" currentUsername={currentUsername} />
      )}
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
