import 'server-only';

import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import { userHeadViewSchema } from '../../application/dto/user-profile.dto';
import type { UserProfileView } from '../../domain/types/user-profile-view';
import { queryApiFetchOutcome } from './query-api.client';

const NOT_FOUND_STATUS = 404;

/**
 * `found` — the account row; `missing` — query-api answered 404 (the account does not exist);
 * `unavailable` — network / 5xx / bad payload: existence is unknown, callers must not 404 on it.
 */
export type UserHeadOutcome =
  | { kind: 'found'; view: UserProfileView }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

/**
 * Profile hero fields from query-api `GET /users/:name/head` — indexed account row only, no viewer,
 * no locale: one cache entry per account for every visitor, usable in a link prefetch.
 */
export async function fetchUserHead(accountName: string): Promise<UserHeadOutcome> {
  const outcome = await queryApiFetchOutcome<unknown>(
    `/query/v1/users/${encodeURIComponent(accountName)}/head`,
    { cacheTags: [queryApiCacheTags.userHead(accountName)] },
  );
  if (!outcome.ok) {
    return outcome.status === NOT_FOUND_STATUS ? { kind: 'missing' } : { kind: 'unavailable' };
  }
  const parsed = userHeadViewSchema.safeParse(outcome.data);
  if (!parsed.success) {
    return { kind: 'unavailable' };
  }
  return { kind: 'found', view: { ...parsed.data, is_following: false, viewer_bell: false } };
}
