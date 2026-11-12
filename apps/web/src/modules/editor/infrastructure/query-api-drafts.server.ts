import 'server-only';

import type { Result } from '@/shared/domain/result';
import {
  queryApiAuthedFetch,
  type QueryApiAuthedError,
} from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { UserPostDraftListApiResponse } from './user-post-draft-api.types';

function draftsListPath(
  author: string,
  query: Record<string, string | number | undefined>,
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') {
      q.set(k, String(v));
    }
  }
  const qs = q.toString();
  return `/query/v1/users/${encodeURIComponent(author)}/drafts${qs ? `?${qs}` : ''}`;
}

/** Server-only list (RSC or actions). */
export async function fetchUserDraftListServer(
  author: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<Result<UserPostDraftListApiResponse, QueryApiAuthedError>> {
  return queryApiAuthedFetch<UserPostDraftListApiResponse>(
    draftsListPath(author, {
      limit: options.limit,
      cursor: options.cursor ?? undefined,
    }),
    { method: 'GET' },
  );
}
