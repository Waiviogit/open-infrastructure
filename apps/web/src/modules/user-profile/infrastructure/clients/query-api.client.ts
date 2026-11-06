import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { headers } from 'next/headers';

import { env } from '@/config/env';
import { getClientIpForwardHeaders } from '@/shared/infrastructure/http/client-ip-forward-headers';

import {
  executeQueryApiRequest,
  isCacheableBody,
  normalizeQueryApiHeaders,
  QUERY_API_CACHE_EXPIRE_SEC,
  QUERY_API_CACHE_REVALIDATE_SEC,
  QUERY_API_FAILURE_EXPIRE_SEC,
  resolveQueryApiUrl,
  type QueryApiFetchOutcome,
  type QueryApiRequest,
} from './query-api-request';

export type { QueryApiFetchOutcome } from './query-api-request';

/** Uncached fetch — use for live wallet/swap reads and post-broadcast refresh. */
export const QUERY_API_LIVE_INIT = {
  cache: 'no-store' as const,
};

export type QueryApiFetchOptions = RequestInit & {
  /** Cache tags — invalidate via `updateTag` after on-chain mutations. */
  cacheTags?: string[];
  /**
   * When true, copy incoming `X-Forwarded-For` onto the upstream request. The header is read
   * outside the cache and becomes part of the cache key.
   */
  forwardClientIp?: boolean;
  /** Legacy fetch option; only `revalidate` (seconds) is honoured, as the cache lifetime. */
  next?: { revalidate?: number | false };
};

/**
 * Cached query-api read. Viewer, locale and body travel in `request`, so they are part of the
 * cache key exactly as they were for the fetch Data Cache. Failures are cached only for a moment.
 */
async function cachedQueryApiRequest<T>(
  request: QueryApiRequest,
  tags: string[],
  revalidateSec: number,
  label: string,
): Promise<QueryApiFetchOutcome<T>> {
  'use cache';
  if (tags.length > 0) {
    cacheTag(...tags);
  }
  const outcome = await executeQueryApiRequest<T>(request, label);
  if (outcome.ok) {
    cacheLife({
      stale: 30,
      revalidate: revalidateSec,
      expire: Math.max(QUERY_API_CACHE_EXPIRE_SEC, revalidateSec * 2),
    });
  } else {
    cacheLife({ stale: 30, revalidate: 1, expire: QUERY_API_FAILURE_EXPIRE_SEC });
  }
  return outcome;
}

async function requestQueryApi<T>(
  path: string,
  init: QueryApiFetchOptions | undefined,
): Promise<QueryApiFetchOutcome<T>> {
  const { cacheTags, forwardClientIp, next, cache, body, headers: initHeaders, method } = init ?? {};
  const extra = forwardClientIp === true ? getClientIpForwardHeaders(await headers()) : {};
  const url = resolveQueryApiUrl(env.QUERY_API_URL, path);
  const requestMethod = method ?? 'GET';
  const requestHeaders = normalizeQueryApiHeaders(initHeaders, extra);

  if (cache === 'no-store' || next?.revalidate === 0 || !isCacheableBody(body)) {
    return executeQueryApiRequest<T>(
      { url, method: requestMethod, headers: requestHeaders, body },
      path,
    );
  }

  const request: QueryApiRequest = {
    url,
    method: requestMethod,
    headers: requestHeaders,
    ...(body != null ? { body } : {}),
  };
  const revalidateSec =
    typeof next?.revalidate === 'number' && next.revalidate > 0
      ? next.revalidate
      : QUERY_API_CACHE_REVALIDATE_SEC;
  return cachedQueryApiRequest<T>(request, cacheTags ?? [], revalidateSec, path);
}

/**
 * Server-only fetch with HTTP status — use when callers must distinguish 503 from 404.
 */
export async function queryApiFetchOutcome<T>(
  path: string,
  init?: QueryApiFetchOptions,
): Promise<QueryApiFetchOutcome<T>> {
  return requestQueryApi<T>(path, init);
}

/**
 * Server-only fetch to query-api.
 * Returns `null` on network failures, 404, or non-OK responses (never throws).
 * Cached for 60 s by default (`'use cache'`, keyed by URL, method, headers and body); pass
 * `cacheTags` for invalidation after broadcast, or `QUERY_API_LIVE_INIT` for an uncached read.
 */
export async function queryApiFetch<T>(
  path: string,
  init?: QueryApiFetchOptions,
): Promise<T | null> {
  const outcome = await requestQueryApi<T>(path, init);
  return outcome.ok ? outcome.data : null;
}

/** Uncached query-api read — **post-broadcast server actions only** (not page-load clients). */
export async function queryApiFetchLive<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  return queryApiFetch<T>(path, { ...init, ...QUERY_API_LIVE_INIT, cacheTags: undefined });
}
