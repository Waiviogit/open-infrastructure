import 'server-only';

import { DEFAULT_FEED_CURRENCY } from '@/modules/feed/domain/feed-currency';
import {
  QUERY_API_LIVE_INIT,
  queryApiFetch,
} from '@/modules/user-profile/infrastructure/clients/query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import type { HubFeedApiFilter } from '../../application/dto/home-feed-filter.dto';
import type { HomeFeedTabKey } from '../../domain/home-feed-tabs';

export type HubFeedRequest = {
  tab: HomeFeedTabKey;
  filter: HubFeedApiFilter;
  limit: number;
  cursor?: string | null;
  viewer: string | null;
  locale: string;
};

/**
 * `POST /query/v1/feed/{tab}`. Posts and every guest feed use the shared cache (viewer and
 * locale are in the request, so they are part of the key); a signed-in viewer's Threads,
 * Activity and Updates stay live so vote and approval state is fresh after a refresh.
 */
export async function fetchHubFeed(request: HubFeedRequest): Promise<unknown> {
  const viewer = request.viewer?.trim() ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Locale': request.locale,
    'Accept-Language': request.locale,
  };
  if (viewer.length > 0) {
    headers['X-Viewer'] = viewer;
  }
  const body = JSON.stringify({
    limit: request.limit,
    filter: request.filter,
    ...(request.cursor ? { cursor: request.cursor } : {}),
    ...(request.tab === 'posts' ? { currency: DEFAULT_FEED_CURRENCY } : {}),
  });
  const live = viewer.length > 0 && request.tab !== 'posts';
  const viewerKey = viewer.length > 0 ? viewer.toLowerCase() : 'guest';

  return queryApiFetch<unknown>(`/query/v1/feed/${request.tab}`, {
    ...(live ? QUERY_API_LIVE_INIT : { cacheTags: [queryApiCacheTags.homeFeed(viewerKey)] }),
    method: 'POST',
    headers,
    body,
  });
}
