import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';
import { getClientIpForwardHeaders } from '@/shared/infrastructure/http/client-ip-forward-headers';

/**
 * BFF proxy for a Discover query-api route that returns object cards (`objects`, `sections`):
 * forwards every query param and adds the request locale, the signed-in viewer and the client IP
 * (affiliate geo).
 */
export async function proxyDiscoverViewerQuery(
  request: NextRequest,
  upstreamPath: 'objects' | 'sections',
): Promise<NextResponse> {
  const base = env.QUERY_API_URL.replace(/\/$/, '');
  const url = new URL(`${base}/query/v1/discover/${upstreamPath}`);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.append(key, value);
  }

  const [locale, user] = await Promise.all([
    getRequestLocale(),
    createCookieAuthContextProvider().getUser(),
  ]);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': locale,
    'X-Locale': locale,
    ...getClientIpForwardHeaders(request.headers),
  };
  const viewer = user?.username?.trim();
  if (viewer) {
    headers['X-Viewer'] = viewer;
  }

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text, {
    status: upstream.ok ? 200 : upstream.status,
    headers: { 'Content-Type': contentType },
  });
}
