import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation';
import {
  HomeFeedFilterNotice,
  HomeUpdatesFeedList,
  homeFeedFilterKey,
  parseHomeFeedFilter,
  resolveHomeFeedFilter,
} from '@/modules/home';
import { getHomeHubUpdatesPage } from '@/modules/home/application/queries/get-home-hub-feed.query';
import { getHomeFeedPresentTabsQuery } from '@/modules/home/application/queries/get-home-feed-presence.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from '../../home-feed-metadata';

type HubFeedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

/** Request-time reads (session, search params) live here, inside the Suspense boundary. */
async function HomeUpdatesFeedContent({ searchParams }: HubFeedPageProps) {
  const [user, params, locale] = await Promise.all([
    getRequestUser(),
    searchParams,
    getRequestLocale(),
  ]);
  const viewer = user?.username ?? null;
  const filterInUrl = parseHomeFeedFilter(params);
  const { effective, requested, notice } = resolveHomeFeedFilter(
    'updates',
    filterInUrl,
    viewer != null,
    await getHomeFeedPresentTabsQuery(filterInUrl),
  );
  const initialPage = await getHomeHubUpdatesPage({ filter: effective, viewer, locale });
  return (
    <>
      <HomeFeedFilterNotice notice={notice} requested={requested} />
      <HomeUpdatesFeedList
        key={homeFeedFilterKey(effective)}
        initialPage={initialPage}
        currentUsername={viewer}
        filter={effective}
      />
    </>
  );
}

export default function HomeUpdatesFeedPage({ searchParams }: HubFeedPageProps) {
  return (
    <main className="min-w-0 pb-section-y">
      <Suspense fallback={<FeedPostsLoadingSkeleton />}>
        <HomeUpdatesFeedContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
