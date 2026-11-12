import 'server-only';

import {
  QUERY_API_LIVE_INIT,
  queryApiFetch,
  queryApiFetchOutcome,
  type QueryApiFetchOutcome,
} from '@/modules/user-profile/infrastructure/clients/query-api.client';

import { DEFAULT_FEED_CURRENCY } from '../../domain/feed-currency';

type SinglePostInit = { locale?: string; viewer?: string | null };

function singlePostPath(author: string, permlink: string): string {
  return `/query/v1/posts/${encodeURIComponent(author)}/${encodeURIComponent(permlink)}?currency=${encodeURIComponent(DEFAULT_FEED_CURRENCY)}`;
}

function singlePostHeaders(
  init: SinglePostInit | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (init?.locale) {
    headers['X-Locale'] = init.locale;
    headers['Accept-Language'] = init.locale;
  }
  if (init?.viewer != null && init.viewer.trim() !== '') {
    headers['X-Viewer'] = init.viewer.trim();
  }
  return headers;
}

export async function fetchSinglePost(
  author: string,
  permlink: string,
  init?: SinglePostInit,
): Promise<unknown | null> {
  return queryApiFetch(singlePostPath(author, permlink), {
    headers: singlePostHeaders(init),
    forwardClientIp: true,
  });
}

/** Uncached read with the HTTP status — an edit must start from the latest published body. */
export async function fetchSinglePostLive(
  author: string,
  permlink: string,
  init?: SinglePostInit,
): Promise<QueryApiFetchOutcome<unknown>> {
  return queryApiFetchOutcome<unknown>(singlePostPath(author, permlink), {
    ...QUERY_API_LIVE_INIT,
    headers: singlePostHeaders(init),
  });
}
