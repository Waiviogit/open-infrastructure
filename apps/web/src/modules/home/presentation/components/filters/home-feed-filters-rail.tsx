import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { getHomeFeedFiltersQuery } from '../../../application/queries/get-home-feed-filters.query';
import { getHomeFeedPresentTabsQuery } from '../../../application/queries/get-home-feed-presence.query';
import {
  homeFeedFilterKey,
  parseHomeFeedFilter,
  type HomeFeedSearchParamsSource,
} from '../../../domain/home-feed-filter';
import type { HomeFeedTabKey } from '../../../domain/home-feed-tabs';
import { HomeFeedFiltersPanel } from './home-feed-filters-panel';
import { HomeFeedFiltersSkeleton } from './home-feed-filters-skeleton';

type HomeFeedFiltersRailProps = {
  tab: HomeFeedTabKey;
  searchParams: Promise<HomeFeedSearchParamsSource>;
};

/** Session, URL filter, counters: request-time reads, inside the rail's own Suspense. */
async function HomeFeedFiltersRailContent({ tab, searchParams }: HomeFeedFiltersRailProps) {
  const [user, params, locale] = await Promise.all([getRequestUser(), searchParams, getRequestLocale()]);
  const viewer = user?.username ?? null;
  const filterInUrl = parseHomeFeedFilter(params);
  const [summary, presentTabs] = await Promise.all([
    viewer ? getHomeFeedFiltersQuery(viewer, tab, locale) : Promise.resolve(null),
    getHomeFeedPresentTabsQuery(filterInUrl),
  ]);
  return (
    <HomeFeedFiltersPanel
      tab={tab}
      signedIn={viewer != null}
      summary={summary}
      presence={
        presentTabs ? { filterKey: homeFeedFilterKey(filterInUrl), tabs: presentTabs } : undefined
      }
    />
  );
}

/**
 * Hub left rail for one tab. Streams independently of the feed: the feed never waits for
 * the counters, and counters that time out still render the follow list without numbers.
 */
export function HomeFeedFiltersRail({ tab, searchParams }: HomeFeedFiltersRailProps) {
  return (
    <Suspense fallback={<HomeFeedFiltersSkeleton />}>
      <HomeFeedFiltersRailContent tab={tab} searchParams={searchParams} />
    </Suspense>
  );
}
