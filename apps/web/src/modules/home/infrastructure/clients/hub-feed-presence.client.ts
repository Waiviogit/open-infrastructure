import 'server-only';

import { queryApiFetch } from '@/modules/user-profile/infrastructure/clients/query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

/** `GET /query/v1/feed/presence?author=` | `?object=` (public; cached, presence changes slowly). */
export async function fetchHubFeedPresence(
  param: { author: string } | { object: string },
): Promise<unknown> {
  const search = new URLSearchParams(param);
  return queryApiFetch<unknown>(`/query/v1/feed/presence?${search.toString()}`, {
    cacheTags: [queryApiCacheTags.homeFeed('presence')],
  });
}
