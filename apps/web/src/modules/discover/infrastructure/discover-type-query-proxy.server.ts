import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';

/** Repeated params forwarded as-is (trimmed, empty values dropped). */
const REPEATED_PARAMS = ['tags', 'category_path'] as const;
const SINGLE_PARAMS = ['q', 'box'] as const;

/**
 * BFF proxy for a Discover query-api route keyed by one object type (`tag-categories`,
 * `categories`): requires `object_type`, forwards the Discover filters through an allowlist.
 */
export async function proxyDiscoverTypeQuery(
  request: NextRequest,
  upstreamPath: 'tag-categories' | 'categories',
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const objectType = params.get('object_type')?.trim();
  if (!objectType) {
    return NextResponse.json({ error: 'Missing object_type' }, { status: 400 });
  }

  const base = env.QUERY_API_URL.replace(/\/$/, '');
  const url = new URL(`${base}/query/v1/discover/${upstreamPath}`);
  url.searchParams.set('object_type', objectType);
  for (const key of SINGLE_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  for (const key of REPEATED_PARAMS) {
    for (const value of params.getAll(key)) {
      const trimmed = value.trim();
      if (trimmed) {
        url.searchParams.append(key, trimmed);
      }
    }
  }

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text, {
    status: upstream.ok ? 200 : upstream.status,
    headers: { 'Content-Type': contentType },
  });
}
