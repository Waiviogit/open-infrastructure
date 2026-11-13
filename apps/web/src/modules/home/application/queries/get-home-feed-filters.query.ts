import 'server-only';

import type { HomeFeedTabKey } from '../../domain/home-feed-tabs';
import { fetchHubFeedFilters } from '../../infrastructure/clients/hub-feed-filters.client';
import {
  homeFeedFilterObjectsPageSchema,
  homeFeedFiltersResponseSchema,
  homeFeedFilterUsersPageSchema,
  type HomeFeedFilterObjectsPage,
  type HomeFeedFiltersView,
  type HomeFeedFilterUsersPage,
} from '../dto/home-feed-filters.dto';

/** Rows shown per rail section before "show more" (same page size for each "show more"). */
export const HOME_FEED_FILTERS_PAGE_SIZE = 5;

const EMPTY_PAGE = { items: [], hasMore: false };

/** Rail summary, or `null` when query-api is unavailable (the rail then shows sorts only). */
export async function getHomeFeedFiltersQuery(
  account: string,
  tab: HomeFeedTabKey,
  locale: string,
): Promise<HomeFeedFiltersView | null> {
  const raw = await fetchHubFeedFilters({
    account,
    tab,
    locale,
    resource: '',
    query: { users_limit: HOME_FEED_FILTERS_PAGE_SIZE, objects_limit: HOME_FEED_FILTERS_PAGE_SIZE },
  });
  if (raw == null) {
    return null;
  }
  const parsed = homeFeedFiltersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeFeedFiltersQuery] unexpected response shape:', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export async function getHomeFeedFilterUsersPageQuery(
  account: string,
  tab: HomeFeedTabKey,
  skip: number,
  locale: string,
): Promise<HomeFeedFilterUsersPage> {
  const raw = await fetchHubFeedFilters({
    account,
    tab,
    locale,
    resource: 'users',
    query: { skip, limit: HOME_FEED_FILTERS_PAGE_SIZE },
  });
  const parsed = homeFeedFilterUsersPageSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_PAGE;
}

export async function getHomeFeedFilterObjectsPageQuery(
  account: string,
  tab: HomeFeedTabKey,
  objectType: string,
  skip: number,
  locale: string,
): Promise<HomeFeedFilterObjectsPage> {
  const raw = await fetchHubFeedFilters({
    account,
    tab,
    locale,
    resource: 'objects',
    query: { object_type: objectType, skip, limit: HOME_FEED_FILTERS_PAGE_SIZE },
  });
  const parsed = homeFeedFilterObjectsPageSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_PAGE;
}
