import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation';
import { HomeFeedGuestPrompt, HomeUpdatesFeedList } from '@/modules/home';
import { getHomeUpdatesFeedPageQuery } from '@/modules/home/application/queries/get-home-followed-feeds.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from '../../home-feed-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

async function HomeUpdatesFeedContent() {
  const user = await getRequestUser();
  const account = user?.username ?? null;
  if (!account) {
    return <HomeFeedGuestPrompt />;
  }
  const initialPage = await getHomeUpdatesFeedPageQuery({
    account,
    locale: await getRequestLocale(),
  });
  return <HomeUpdatesFeedList initialPage={initialPage} currentUsername={account} />;
}

export default function HomeUpdatesFeedPage() {
  return (
    <main className="min-w-0 pb-section-y">
      <Suspense fallback={<FeedPostsLoadingSkeleton />}>
        <HomeUpdatesFeedContent />
      </Suspense>
    </main>
  );
}
