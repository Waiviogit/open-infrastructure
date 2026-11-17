import { z } from 'zod';

/**
 * LinkedIn `/embed/feed/update/…` iframes never post their height to the parent page
 * (unlike Instagram / Facebook / X), so the web app does not show them. The BFF reads the
 * post's server-rendered embed page and returns the card data; the client renders the
 * card itself. Layouts the parser does not know fall back to the iframe.
 * @see docs/apps/web/spec/components/linkedin-embed.md
 */

const LINKEDIN_EMBED_URN = /^urn:li:(?:activity|ugcPost|share):\d{10,20}$/;
const LINKEDIN_EMBED_SRC_URN =
  /^https:\/\/(?:www\.)?linkedin\.com\/embed\/feed\/update\/(urn:li:(?:activity|ugcPost|share):\d{10,20})(?:[?#]|$)/i;

const TEST_ID_ATTR = /data-test-id="([^"]+)"/g;
const COMMENTARY_TEST_ID = 'main-feed-activity-embed-card__commentary';
const AUTHOR_TEST_ID = 'main-feed-activity-embed-card__entity-lockup';
const LOGO_TEST_ID = 'main-feed-activity-embed-card__linkedin-logo-image';
const ACTIVITY_HEADER_TEST_ID = 'main-feed-activity-card__header';
const IMAGES_TEST_ID = 'feed-images-content';
const IMAGE_ITEM_TEST_ID = 'feed-images-content__list-item';
const ARTICLE_TEST_ID = 'article-content';
const ARTICLE_TITLE_TEST_ID = 'article-content__title';
const ARTICLE_SUBTITLE_TEST_ID = 'article-content__subtitle';
const VIDEO_TEST_ID = 'feed-native-video-content';
const REACTIONS_TEST_ID = 'social-actions__reactions';
const COMMENTS_TEST_ID = 'social-actions__comments';

/** Blocks the card knows; any other `data-test-id` (reshare, document, poll, …) keeps the iframe. */
const KNOWN_TEST_IDS: ReadonlySet<string> = new Set([
  COMMENTARY_TEST_ID,
  AUTHOR_TEST_ID,
  LOGO_TEST_ID,
  ACTIVITY_HEADER_TEST_ID,
  IMAGES_TEST_ID,
  IMAGE_ITEM_TEST_ID,
  ARTICLE_TEST_ID,
  ARTICLE_TITLE_TEST_ID,
  ARTICLE_SUBTITLE_TEST_ID,
  VIDEO_TEST_ID,
  REACTIONS_TEST_ID,
  COMMENTS_TEST_ID,
  'main-feed-activity-embed-card__social-actions',
  'nav-logo',
  'social-actions__reaction-count',
]);

/** Author lockup markup is short; the bound only guards against a missing logo marker. */
const AUTHOR_LOCKUP_MAX_CHARS = 6000;
/** Video `data-aspect-ratio` outside this range is treated as unknown. */
const MIN_VIDEO_ASPECT_RATIO = 0.25;
const MAX_VIDEO_ASPECT_RATIO = 4;

/** Links in the card point to LinkedIn; media is served from its CDN. */
const LINK_HOST = /(?:^|\.)linkedin\.com$/i;
const MEDIA_HOST = /(?:^|\.)licdn\.com$/i;
/** Click-tracking parameter LinkedIn appends to every embed link. */
const TRACKING_PARAM = 'trk';

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const httpsUrl = z.url({ protocol: /^https$/ });
const countSchema = z.number().int().nonnegative().nullable();

const mediaSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('images'),
    images: z.array(z.object({ url: httpsUrl, alt: z.string() })).min(1),
  }),
  z.object({
    kind: z.literal('article'),
    url: httpsUrl,
    title: z.string(),
    subtitle: z.string(),
    imageUrl: httpsUrl.nullable(),
  }),
  z.object({
    kind: z.literal('video'),
    sources: z.array(httpsUrl).min(1),
    posterUrl: httpsUrl.nullable(),
    aspectRatio: z.number().positive().nullable(),
  }),
]);

export const linkedInPostCardSchema = z.object({
  permalink: httpsUrl,
  /** "Name reposted this" line above the author, as LinkedIn wrote it. */
  activityHeader: z.string().nullable(),
  author: z.object({
    name: z.string().min(1),
    headline: z.string(),
    profileUrl: httpsUrl.nullable(),
    avatarUrl: httpsUrl.nullable(),
  }),
  /** Post text as plain text, line breaks kept. */
  commentary: z.string(),
  media: mediaSchema,
  reactionCount: countSchema,
  commentCount: countSchema,
});

export type LinkedInPostCard = z.infer<typeof linkedInPostCardSchema>;
export type LinkedInPostMedia = LinkedInPostCard['media'];

export function isLinkedInEmbedUrn(value: string): boolean {
  return LINKEDIN_EMBED_URN.test(value);
}

/** `urn:li:…` of a LinkedIn embed iframe `src`, or `null` for any other URL. */
export function linkedInUrnFromEmbedSrc(src: string): string | null {
  return src.trim().match(LINKEDIN_EMBED_SRC_URN)?.[1] ?? null;
}

export function linkedInEmbedPageUrl(urn: string): string {
  return `https://www.linkedin.com/embed/feed/update/${urn}`;
}

export function linkedInPostPermalink(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}`;
}

function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith('#x')) {
        return safeFromCodePoint(Number.parseInt(lower.slice(2), 16)) ?? match;
      }
      if (lower.startsWith('#')) {
        return safeFromCodePoint(Number.parseInt(lower.slice(1), 10)) ?? match;
      }
      return NAMED_ENTITIES[lower] ?? match;
    },
  );
}

function safeFromCodePoint(codePoint: number): string | null {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}

function readAttr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return match ? decodeHtmlEntities(match[1]) : null;
}

/** Text content of an HTML fragment, whitespace collapsed. */
function plainText(fragment: string): string {
  return decodeHtmlEntities(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(raw: string | null, host: RegExp): string | null {
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || !host.test(url.hostname)) {
      return null;
    }
    url.searchParams.delete(TRACKING_PARAM);
    return url.toString();
  } catch {
    return null;
  }
}

type TagMatch = { tag: string; tagName: string; start: number; end: number };

/** Opening tag of the element carrying `data-test-id="testId"`. */
function findTestIdTag(html: string, testId: string): TagMatch | null {
  const marker = html.indexOf(`data-test-id="${testId}"`);
  if (marker < 0) {
    return null;
  }
  const start = html.lastIndexOf('<', marker);
  const end = html.indexOf('>', marker);
  if (start < 0 || end < 0) {
    return null;
  }
  const tag = html.slice(start, end + 1);
  const tagName = tag.match(/^<([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
  return tagName ? { tag, tagName, start, end: end + 1 } : null;
}

/** Inner HTML up to the first closing tag of the same name (the blocks read here do not nest). */
function testIdInner(html: string, testId: string): string | null {
  const open = findTestIdTag(html, testId);
  if (!open) {
    return null;
  }
  const close = html.indexOf(`</${open.tagName}>`, open.end);
  return close < 0 ? null : html.slice(open.end, close);
}

function extractCommentary(html: string): string {
  const inner = testIdInner(html, COMMENTARY_TEST_ID);
  if (inner === null) {
    return '';
  }
  const text = inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(text).trim();
}

function extractActivityHeader(html: string): string | null {
  const inner = testIdInner(html, ACTIVITY_HEADER_TEST_ID);
  const text = inner === null ? '' : plainText(inner);
  return text === '' ? null : text;
}

function extractAuthor(html: string): LinkedInPostCard['author'] | null {
  const open = findTestIdTag(html, AUTHOR_TEST_ID);
  if (!open) {
    return null;
  }
  const logo = html.indexOf(`data-test-id="${LOGO_TEST_ID}"`, open.end);
  const lockup = html.slice(
    open.end,
    logo > open.end ? logo : open.end + AUTHOR_LOCKUP_MAX_CHARS,
  );
  const nameLink = lockup.match(
    /<a\b[^>]*feed-actor-name[^>]*>([\s\S]*?)<\/a>/i,
  );
  const name = nameLink ? plainText(nameLink[1]) : '';
  if (!nameLink || name === '') {
    return null;
  }
  const afterName = lockup.slice((nameLink.index ?? 0) + nameLink[0].length);
  const headline = afterName.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const avatarTag = lockup.match(/<div\b[^>]*\srole="img"[^>]*>/i)?.[0] ?? '';
  return {
    name,
    headline: headline ? plainText(headline[1]) : '',
    profileUrl: safeUrl(readAttr(nameLink[0], 'href'), LINK_HOST),
    avatarUrl: safeUrl(readAttr(avatarTag, 'data-delayed-url'), MEDIA_HOST),
  };
}

function extractImages(html: string): LinkedInPostMedia | null {
  const inner = testIdInner(html, IMAGES_TEST_ID);
  if (inner === null) {
    return null;
  }
  const images = Array.from(inner.matchAll(/<img\b[^>]*>/gi), ([tag]) => ({
    url: safeUrl(
      readAttr(tag, 'data-delayed-url') ?? readAttr(tag, 'src'),
      MEDIA_HOST,
    ),
    alt: readAttr(tag, 'alt') ?? '',
  })).flatMap(({ url, alt }) => (url ? [{ url, alt }] : []));
  return images.length > 0 ? { kind: 'images', images } : null;
}

function extractArticle(html: string): LinkedInPostMedia | null {
  const open = findTestIdTag(html, ARTICLE_TEST_ID);
  const inner = testIdInner(html, ARTICLE_TEST_ID);
  const url = open ? safeUrl(readAttr(open.tag, 'href'), LINK_HOST) : null;
  if (!open || inner === null || !url) {
    return null;
  }
  const imageTag = inner.match(/<img\b[^>]*>/i)?.[0] ?? '';
  return {
    kind: 'article',
    url,
    title: plainText(testIdInner(inner, ARTICLE_TITLE_TEST_ID) ?? ''),
    subtitle: plainText(testIdInner(inner, ARTICLE_SUBTITLE_TEST_ID) ?? ''),
    imageUrl: safeUrl(readAttr(imageTag, 'data-delayed-url'), MEDIA_HOST),
  };
}

function parseVideoSources(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((item: unknown) => {
    const rec =
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>)
        : {};
    const src =
      rec.type === 'video/mp4' && typeof rec.src === 'string' ? rec.src : null;
    const url = safeUrl(src, MEDIA_HOST);
    return url ? [url] : [];
  });
}

function parseAspectRatio(raw: string | null): number | null {
  const value = raw === null ? Number.NaN : Number.parseFloat(raw);
  return Number.isFinite(value) &&
    value >= MIN_VIDEO_ASPECT_RATIO &&
    value <= MAX_VIDEO_ASPECT_RATIO
    ? value
    : null;
}

function extractVideo(html: string): LinkedInPostMedia | null {
  const open = findTestIdTag(html, VIDEO_TEST_ID);
  if (!open) {
    return null;
  }
  const videoTag = html.slice(open.end).match(/<video\b[^>]*>/i)?.[0] ?? '';
  const sources = parseVideoSources(readAttr(videoTag, 'data-sources'));
  if (sources.length === 0) {
    return null;
  }
  return {
    kind: 'video',
    sources,
    posterUrl: safeUrl(readAttr(videoTag, 'data-poster-url'), MEDIA_HOST),
    aspectRatio: parseAspectRatio(readAttr(videoTag, 'data-aspect-ratio')),
  };
}

function readCount(html: string, testId: string, attr: string): number | null {
  const open = findTestIdTag(html, testId);
  const raw = open ? readAttr(open.tag, attr) : null;
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** Media block, `null` when a known block is present but unreadable. */
function extractMedia(
  html: string,
  testIds: readonly string[],
): LinkedInPostMedia | null {
  const blocks = [IMAGES_TEST_ID, ARTICLE_TEST_ID, VIDEO_TEST_ID].filter((id) =>
    testIds.includes(id),
  );
  if (blocks.length === 0) {
    return { kind: 'none' };
  }
  if (blocks.length > 1) {
    return null;
  }
  if (blocks[0] === IMAGES_TEST_ID) {
    return extractImages(html);
  }
  if (blocks[0] === ARTICLE_TEST_ID) {
    return extractArticle(html);
  }
  return extractVideo(html);
}

/** Card of a LinkedIn embed page, or `null` when the markup has a block the card does not know. */
export function parseLinkedInPostCard(
  html: string,
  urn: string,
): LinkedInPostCard | null {
  if (!isLinkedInEmbedUrn(urn)) {
    return null;
  }
  const testIds = Array.from(html.matchAll(TEST_ID_ATTR), (m) => m[1]);
  if (testIds.some((id) => !KNOWN_TEST_IDS.has(id))) {
    return null;
  }
  const author = extractAuthor(html);
  const media = extractMedia(html, testIds);
  if (!author || !media) {
    return null;
  }
  const card: LinkedInPostCard = {
    permalink: linkedInPostPermalink(urn),
    activityHeader: extractActivityHeader(html),
    author,
    commentary: extractCommentary(html),
    media,
    reactionCount: readCount(html, REACTIONS_TEST_ID, 'data-num-reactions'),
    commentCount: readCount(html, COMMENTS_TEST_ID, 'data-num-comments'),
  };
  return linkedInPostCardSchema.safeParse(card).success ? card : null;
}

/** Marks where a LinkedIn card mounts inside sanitized post HTML. */
export const LINKEDIN_POST_SLOT_CLASS = 'linkedin-post-slot';
export const LINKEDIN_POST_SLOT_URN_ATTR = 'data-linkedin-urn';

const WRAPPED_IFRAME =
  /<div class="blog-post-linkedin-embed">\s*(<iframe\b[^>]*>\s*<\/iframe>)\s*<\/div>/gi;
const BARE_IFRAME = /<iframe\b[^>]*>\s*<\/iframe>/gi;

function slotForIframe(iframe: string): string | null {
  const src = readAttr(iframe, 'src');
  const urn = src ? linkedInUrnFromEmbedSrc(src) : null;
  return urn
    ? `<div class="${LINKEDIN_POST_SLOT_CLASS}" ${LINKEDIN_POST_SLOT_URN_ATTR}="${urn}"></div>`
    : null;
}

/**
 * Swaps LinkedIn embed iframes in sanitized post HTML for empty card slots, so the
 * iframe never loads; `useLinkedInPostSlots` mounts the card into each slot.
 */
export function linkedInIframesToCardSlots(html: string): string {
  if (!html.includes('linkedin.com/embed/')) {
    return html;
  }
  return html
    .replace(
      WRAPPED_IFRAME,
      (match, iframe: string) => slotForIframe(iframe) ?? match,
    )
    .replace(BARE_IFRAME, (match) => slotForIframe(match) ?? match);
}

export type LinkedInPostCardResult =
  | { status: 'card'; card: LinkedInPostCard }
  | { status: 'unavailable' };

const cardRequests = new Map<string, Promise<LinkedInPostCardResult>>();

/** Client fetch of the BFF card; one request per URN for the page lifetime. */
export function fetchLinkedInPostCard(
  urn: string,
): Promise<LinkedInPostCardResult> {
  if (!isLinkedInEmbedUrn(urn)) {
    return Promise.resolve({ status: 'unavailable' });
  }
  const cached = cardRequests.get(urn);
  if (cached) {
    return cached;
  }
  const request = requestLinkedInPostCard(urn);
  cardRequests.set(urn, request);
  return request;
}

async function requestLinkedInPostCard(
  urn: string,
): Promise<LinkedInPostCardResult> {
  try {
    const res = await fetch(
      `/api/social-embed/linkedin?urn=${encodeURIComponent(urn)}`,
      {
        headers: { Accept: 'application/json' },
      },
    );
    if (!res.ok) {
      return { status: 'unavailable' };
    }
    const data = (await res.json()) as { card?: unknown };
    const parsed = linkedInPostCardSchema.safeParse(data.card);
    return parsed.success
      ? { status: 'card', card: parsed.data }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
