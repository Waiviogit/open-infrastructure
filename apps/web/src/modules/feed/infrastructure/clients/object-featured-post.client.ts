import 'server-only';

import { queryApiFetch } from '@/modules/user-profile/infrastructure/clients/query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import { DEFAULT_FEED_CURRENCY } from '../../domain/feed-currency';

/** Raw `{ post }` body of `GET /query/v1/objects/:objectId/featured-post`, or null on failure / 404. */
export async function fetchObjectFeaturedPost(
  objectId: string,
  init?: { locale?: string; viewer?: string | null },
): Promise<unknown | null> {
  const path = `/query/v1/objects/${encodeURIComponent(objectId)}/featured-post?currency=${encodeURIComponent(DEFAULT_FEED_CURRENCY)}`;
  const headers: Record<string, string> = {};
  if (init?.locale) {
    headers['X-Locale'] = init.locale;
    headers['Accept-Language'] = init.locale;
  }
  if (init?.viewer != null && init.viewer.trim() !== '') {
    headers['X-Viewer'] = init.viewer.trim();
  }
  return queryApiFetch(path, {
    headers,
    forwardClientIp: true,
    cacheTags: [queryApiCacheTags.objectFeaturedPost(objectId)],
  });
}
