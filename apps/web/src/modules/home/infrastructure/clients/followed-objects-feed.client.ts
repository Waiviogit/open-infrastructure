import 'server-only';

import {
  QUERY_API_LIVE_INIT,
  queryApiFetch,
} from '@/modules/user-profile/infrastructure/clients/query-api.client';

/** query-api resource under `POST /query/v1/users/:name/following-objects/…`. */
export type FollowedObjectsFeedResource = 'messages' | 'threads' | 'updates';

export type FollowedObjectsFeedRequest = {
  account: string;
  resource: FollowedObjectsFeedResource;
  body: { limit: number; cursor?: string };
  locale: string;
};

/**
 * Hub followed-objects feeds. The account is also the viewer (mutes + vote state).
 * Uncached: personalized per viewer and must reflect votes right after a refresh.
 */
export async function fetchFollowedObjectsFeed(
  request: FollowedObjectsFeedRequest,
): Promise<unknown> {
  const account = request.account.trim();
  const path = `/query/v1/users/${encodeURIComponent(account)}/following-objects/${request.resource}`;
  return queryApiFetch<unknown>(path, {
    ...QUERY_API_LIVE_INIT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viewer': account,
      'X-Locale': request.locale,
      'Accept-Language': request.locale,
    },
    body: JSON.stringify(request.body),
  });
}
