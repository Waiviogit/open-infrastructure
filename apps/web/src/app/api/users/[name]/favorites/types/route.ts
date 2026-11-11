import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { safeFetch } from '@/shared/infrastructure/http/safe-fetch.server';

/** BFF for the profile Favorites filters rail: types of the user's Favorites scope. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const accountName = decodeURIComponent(name).trim();
  if (!accountName) {
    return NextResponse.json({ error: 'Missing account name' }, { status: 400 });
  }

  const base = env.QUERY_API_URL.replace(/\/$/, '');
  const url = `${base}/query/v1/users/${encodeURIComponent(accountName)}/favorites/types`;

  const upstream = await safeFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 502 });
  }

  const text = await upstream.response.text();
  const contentType = upstream.response.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text, {
    status: upstream.response.ok ? 200 : upstream.response.status,
    headers: { 'Content-Type': contentType },
  });
}
