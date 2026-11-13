import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { getHomeFeedFiltersQuery } from '../../../application/queries/get-home-feed-filters.query';
import type { HomeFeedTabKey } from '../../../domain/home-feed-tabs';
import { HomeFeedFiltersPanel } from './home-feed-filters-panel';
import { HomeFeedFiltersSkeleton } from './home-feed-filters-skeleton';

/** Session + counters: request-time reads, so they stay inside the rail's own Suspense. */
async function HomeFeedFiltersRailContent({ tab }: { tab: HomeFeedTabKey }) {
  const user = await getRequestUser();
  const viewer = user?.username ?? null;
  const summary = viewer ? await getHomeFeedFiltersQuery(viewer, tab, await getRequestLocale()) : null;
  return <HomeFeedFiltersPanel tab={tab} signedIn={viewer != null} summary={summary} />;
}

/**
 * Hub left rail for one tab. Streams independently of the feed: the feed never waits for
 * the counters, and counters that time out still render the follow list without numbers.
 */
export function HomeFeedFiltersRail({ tab }: { tab: HomeFeedTabKey }) {
  return (
    <Suspense fallback={<HomeFeedFiltersSkeleton />}>
      <HomeFeedFiltersRailContent tab={tab} />
    </Suspense>
  );
}
