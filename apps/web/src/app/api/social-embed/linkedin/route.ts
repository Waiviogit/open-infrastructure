import { type NextRequest, NextResponse } from 'next/server';

import { safeFetch } from '@/shared/infrastructure/http/safe-fetch.server';
import {
  isLinkedInEmbedUrn,
  linkedInEmbedPageUrl,
  parseLinkedInPostCard,
} from '@/shared/infrastructure/linkedin-post-card';

const CACHE_TTL_LINKEDIN_CARD_SEC = 3600;
const LINKEDIN_EMBED_TIMEOUT_MS = 5000;
/** Embed pages are ~20–30 KB; anything far larger is not the card we parse. */
const LINKEDIN_EMBED_MAX_BYTES = 512 * 1024;

/** Card data of a LinkedIn post, rendered by the client instead of the embed iframe. */
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get('urn')?.trim() ?? '';
  if (!isLinkedInEmbedUrn(urn)) {
    return NextResponse.json({ error: 'invalid_urn' }, { status: 400 });
  }

  const fetched = await safeFetch(linkedInEmbedPageUrl(urn), {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Waivio/1.0 (social-embed)',
    },
    signal: AbortSignal.timeout(LINKEDIN_EMBED_TIMEOUT_MS),
  });
  if (!fetched.ok) {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
  if (!fetched.response.ok) {
    const status = fetched.response.status === 404 ? 404 : 502;
    return NextResponse.json({ error: 'unavailable' }, { status });
  }

  let html: string;
  try {
    html = await fetched.response.text();
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
  if (html.length > LINKEDIN_EMBED_MAX_BYTES) {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }

  const card = parseLinkedInPostCard(html, urn);
  if (!card) {
    return NextResponse.json({ error: 'unsupported_layout' }, { status: 422 });
  }

  return NextResponse.json(
    { card },
    {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_TTL_LINKEDIN_CARD_SEC}`,
      },
    },
  );
}
