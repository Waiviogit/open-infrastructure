import { unstable_rethrow } from 'next/navigation';

/**
 * Serializable query-api request and its outcome. Everything here is plain data so a request can
 * be the argument (and therefore the cache key) of a `'use cache'` function.
 */
export type QueryApiRequest = {
  url: string;
  method: string;
  /** Lower-case header names, sorted, so equivalent requests produce the same cache key. */
  headers: Record<string, string>;
  body?: string;
};

export type QueryApiFetchOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | 'network' };

/** Default lifetime of a cached query-api read (matches the former fetch `next.revalidate: 60`). */
export const QUERY_API_CACHE_REVALIDATE_SEC = 60;

/** Upper bound for an unused cached read before it is dropped. */
export const QUERY_API_CACHE_EXPIRE_SEC = 3600;

/** Failed reads (network, 404, 5xx, bad JSON) stay cached only this long. */
export const QUERY_API_FAILURE_EXPIRE_SEC = 2;

export function resolveQueryApiUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function normalizeQueryApiHeaders(
  input: HeadersInit | undefined,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers = new Headers(input);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  const entries = [...headers.entries()].sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

/**
 * Only string bodies can be part of a cache key; anything else (FormData, streams) makes the
 * request uncacheable.
 */
export function isCacheableBody(body: BodyInit | null | undefined): body is string | undefined {
  return body == null || typeof body === 'string';
}

/**
 * Performs the request without any Next.js caching. Never throws, except Next.js control-flow
 * errors (`unstable_rethrow`: e.g. a completed prerender rejecting its fetch). Uncached callers may pass any
 * `BodyInit`; cached callers pass a {@link QueryApiRequest} with a string body.
 */
export async function executeQueryApiRequest<T>(
  request: Omit<QueryApiRequest, 'body'> & { body?: BodyInit | null },
  label: string,
): Promise<QueryApiFetchOutcome<T>> {
  let res: Response;
  try {
    res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      cache: 'no-store',
    });
  } catch (err) {
    // A prerender (App Shell for a prefetch) that completes rejects its pending fetches: that is
    // Next's control flow, not a network failure — let React handle it instead of logging it.
    unstable_rethrow(err);
    console.error(`[query-api] network error for ${label}:`, err);
    return { ok: false, status: 'network' };
  }
  if (!res.ok) {
    if (res.status !== 404) {
      console.error(`[query-api] ${res.status} for ${label}`);
    }
    return { ok: false, status: res.status };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    console.error(`[query-api] invalid JSON for ${label}:`, err);
    return { ok: false, status: res.status };
  }
}
