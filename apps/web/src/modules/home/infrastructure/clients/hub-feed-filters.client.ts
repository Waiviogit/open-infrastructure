import 'server-only';

import { queryApiFetch } from '@/modules/user-profile/infrastructure/clients/query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import type { HomeFeedTabKey } from '../../domain/home-feed-tabs';

export type HubFeedFiltersRequest = {
  account: string;
  tab: HomeFeedTabKey;
  locale: string;
  /** `''` = summary; `users` / `objects` = "show more" pages. */
  resource: '' | 'users' | 'objects';
  query: Record<string, string | number>;
};

/**
 * `GET /query/v1/users/:name/feed-filters[/users|/objects]`, cached per account (the
 * account is also the viewer) and invalidated with the account's follow broadcasts.
 */
export async function fetchHubFeedFilters(request: HubFeedFiltersRequest): Promise<unknown> {
  const account = request.account.trim();
  const search = new URLSearchParams({ tab: request.tab });
  for (const [key, value] of Object.entries(request.query)) {
    search.set(key, String(value));
  }
  const suffix = request.resource ? `/${request.resource}` : '';
  const path = `/query/v1/users/${encodeURIComponent(account)}/feed-filters${suffix}?${search.toString()}`;
  return queryApiFetch<unknown>(path, {
    headers: {
      'X-Viewer': account,
      'X-Locale': request.locale,
      'Accept-Language': request.locale,
    },
    cacheTags: [queryApiCacheTags.homeFeedFilters(account)],
  });
}
