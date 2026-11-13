import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation';
import {
  HomeFeedFilterNotice,
  HomeFeedPostsList,
  homeFeedFilterKey,
  parseHomeFeedFilter,
  resolveHomeFeedFilter,
} from '@/modules/home';
import { getHomeHubPostsPage } from '@/modules/home/application/queries/get-home-hub-feed.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from './home-feed-metadata';

type HubFeedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

/** Request-time reads (session, search params) live here, inside the Suspense boundary. */
async function HomePostsFeedContent({ searchParams }: HubFeedPageProps) {
  const [user, params, locale] = await Promise.all([
    getRequestUser(),
    searchParams,
    getRequestLocale(),
  ]);
  const viewer = user?.username ?? null;
  const { effective, requested, notice } = resolveHomeFeedFilter(
    'posts',
    parseHomeFeedFilter(params),
    viewer != null,
  );
  const initialPage = await getHomeHubPostsPage({ filter: effective, viewer, locale });
  return (
    <>
      <HomeFeedFilterNotice notice={notice} requested={requested} />
      <HomeFeedPostsList
        key={homeFeedFilterKey(effective)}
        initialPage={initialPage}
        currentUsername={viewer}
        filter={effective}
      />
    </>
  );
}

export default function Index({ searchParams }: HubFeedPageProps) {
  return (
    <main className="min-w-0 pb-section-y">
      <Suspense fallback={<FeedPostsLoadingSkeleton />}>
        <HomePostsFeedContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
