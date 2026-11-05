import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/config/env';
import { isPostEditorGooglePlacesEnabled } from '@/config/post-editor-defaults';
import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';
import { getClientIpForwardHeaders } from '@/shared/infrastructure/http/client-ip-forward-headers';
import { safeFetch } from '@/shared/infrastructure/http/safe-fetch.server';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

/**
 * BFF proxy for query-api `/places/*`. Google Places calls are billed, so only
 * signed-in users get through; the client IP is forwarded for GeoIP bias and
 * the per-IP budget in query-api.
 */
export async function proxyPlacesRequest(
  request: NextRequest,
  upstreamPath: string,
  searchParams?: URLSearchParams,
): Promise<NextResponse> {
  if (!isPostEditorGooglePlacesEnabled()) {
    return NextResponse.json({ error: 'places_disabled' }, { status: HTTP_NOT_FOUND });
  }
  const [locale, user] = await Promise.all([
    getRequestLocale(),
    createCookieAuthContextProvider().getUser(),
  ]);
  if (!user?.username?.trim()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const base = env.QUERY_API_URL.replace(/\/$/, '');
  const url = new URL(`${base}/query/v1/places${upstreamPath}`);
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }

  const result = await safeFetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': locale,
      'X-Locale': locale,
      ...getClientIpForwardHeaders(request.headers),
    },
    cache: 'no-store',
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: HTTP_BAD_GATEWAY });
  }

  const text = await result.response.text();
  return new NextResponse(text, {
    status: result.response.status,
    headers: {
      'Content-Type': result.response.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
