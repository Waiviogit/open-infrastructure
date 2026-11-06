import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation';
import { HOME_FEED_PAGE_SIZE, HomeFeedPostsList } from '@/modules/home';
import { getHomeFeedPageQuery } from '@/modules/home/application/queries/get-home-feed-page.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from './home-feed-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

async function HomePostsFeedContent() {
  const user = await getRequestUser();
  const viewer = user?.username ?? null;
  const initialPage = await getHomeFeedPageQuery({ limit: HOME_FEED_PAGE_SIZE }, viewer);
  return <HomeFeedPostsList initialPage={initialPage} currentUsername={viewer} />;
}

export default function Index() {
  return (
    <main className="min-w-0 pb-section-y">
      <Suspense fallback={<FeedPostsLoadingSkeleton />}>
        <HomePostsFeedContent />
      </Suspense>
    </main>
  );
}
