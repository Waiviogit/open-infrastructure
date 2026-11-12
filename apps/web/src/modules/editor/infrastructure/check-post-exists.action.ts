'use server';

import { queryApiAuthedFetch } from '@/shared/infrastructure/http/query-api-authed-fetch.server';

/** Returns true when a post already exists at author/permlink. */
export async function checkPostExistsAction(
  author: string,
  permlink: string,
): Promise<boolean> {
  const path = `/query/v1/posts/${encodeURIComponent(author.trim())}/${encodeURIComponent(permlink.trim())}`;
  const result = await queryApiAuthedFetch<unknown>(path, { method: 'GET' });
  return result.ok;
}
