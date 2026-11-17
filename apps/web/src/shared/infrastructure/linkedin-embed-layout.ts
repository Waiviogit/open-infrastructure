/**
 * LinkedIn `/embed/feed/update/…` iframes never post their height to the parent page
 * (unlike Instagram / Facebook / X), so the card height is estimated from the post's
 * server-rendered embed HTML: the layout below plus the commentary wrapped at the
 * iframe width. Block sizes were measured on the live embed at 340–540px widths.
 * @see docs/apps/web/spec/components/story-container.md
 */

/** Media block under the commentary. Anything else (video, document, poll, …) is not estimated. */
export type LinkedInEmbedMedia = 'none' | 'image' | 'image-grid' | 'article';

export type LinkedInEmbedLayout = {
  /** Post text as plain text, line breaks kept (rendered `white-space: pre-wrap`). */
  commentary: string;
  /** "Name reposted this" / "Name likes this" line above the author row. */
  hasActivityHeader: boolean;
  media: LinkedInEmbedMedia;
};

/** Commentary font inside the embed (`text-sm`, computed line height 21px). */
export const LINKEDIN_EMBED_TEXT_FONT =
  '14px/21px -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Fira Sans", Ubuntu, Oxygen, "Oxygen Sans", Cantarell, "Droid Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Lucida Grande", Helvetica, Arial, sans-serif';

/** 1px card border + 16px side padding on each side. */
const CARD_HORIZONTAL_INSET_PX = 34;
/** Border, top padding, author row, text gaps, reactions row, Like / Comment / Share bar. */
const CARD_CHROME_PX = 181;
/** Activity header line, its padding, divider and bottom margin. */
const ACTIVITY_HEADER_PX = 40;
/** Gap between the commentary and the media block. */
const MEDIA_GAP_PX = 4;
/** One image is `max-h-[400px]`; aspect is unknown, so the cap is the upper bound. */
const SINGLE_IMAGE_MAX_PX = 400;
/** Multi-image grid is a fixed 360px box at embed widths. */
const IMAGE_GRID_PX = 360;
/** Shared article link card (cover + title + source), upper bound across widths. */
const ARTICLE_CARD_PX = 470;
/** Covers the bottom wrapper border and bold link text wrapping a line later. */
const SAFETY_PX = 8;

const MEDIA_HEIGHT_PX: Record<LinkedInEmbedMedia, number> = {
  none: 0,
  image: SINGLE_IMAGE_MAX_PX,
  'image-grid': IMAGE_GRID_PX,
  article: ARTICLE_CARD_PX,
};

const LINKEDIN_EMBED_URN = /^urn:li:(?:activity|ugcPost|share):\d{10,20}$/;
const LINKEDIN_EMBED_SRC_URN =
  /^https:\/\/(?:www\.)?linkedin\.com\/embed\/feed\/update\/(urn:li:(?:activity|ugcPost|share):\d{10,20})(?:[?#]|$)/i;

const TEST_ID_ATTR = /data-test-id="([^"]+)"/g;
const COMMENTARY_TEST_ID = 'main-feed-activity-embed-card__commentary';
const AUTHOR_TEST_ID = 'main-feed-activity-embed-card__entity-lockup';
const ACTIVITY_HEADER_TEST_ID = 'main-feed-activity-card__header';
const IMAGES_TEST_ID = 'feed-images-content';
const IMAGE_ITEM_TEST_ID = 'feed-images-content__list-item';
const ARTICLE_TEST_ID = 'article-content';

/** Blocks the estimate knows; any other `data-test-id` means an unmeasured layout. */
const KNOWN_TEST_IDS: ReadonlySet<string> = new Set([
  COMMENTARY_TEST_ID,
  AUTHOR_TEST_ID,
  ACTIVITY_HEADER_TEST_ID,
  IMAGES_TEST_ID,
  IMAGE_ITEM_TEST_ID,
  ARTICLE_TEST_ID,
  'article-content__title',
  'article-content__subtitle',
  'main-feed-activity-embed-card__linkedin-logo-image',
  'main-feed-activity-embed-card__social-actions',
  'nav-logo',
  'social-actions__reactions',
  'social-actions__reaction-count',
  'social-actions__comments',
]);

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

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

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      return safeFromCodePoint(Number.parseInt(lower.slice(2), 16)) ?? match;
    }
    if (lower.startsWith('#')) {
      return safeFromCodePoint(Number.parseInt(lower.slice(1), 10)) ?? match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

function safeFromCodePoint(codePoint: number): string | null {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}

function extractCommentary(html: string): string {
  const marker = html.indexOf(`data-test-id="${COMMENTARY_TEST_ID}"`);
  if (marker < 0) {
    return '';
  }
  const start = html.indexOf('>', marker);
  const end = html.indexOf('</p>', start);
  if (start < 0 || end < 0) {
    return '';
  }
  const inner = html
    .slice(start + 1, end)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(inner);
}

/** Layout of a LinkedIn embed page, or `null` when the markup has a block the estimate does not know. */
export function parseLinkedInEmbedLayout(html: string): LinkedInEmbedLayout | null {
  const testIds = Array.from(html.matchAll(TEST_ID_ATTR), (m) => m[1]);
  if (!testIds.includes(AUTHOR_TEST_ID)) {
    return null;
  }
  if (testIds.some((id) => !KNOWN_TEST_IDS.has(id))) {
    return null;
  }
  const imageCount = testIds.filter((id) => id === IMAGE_ITEM_TEST_ID).length;
  const hasArticle = testIds.includes(ARTICLE_TEST_ID);
  if (hasArticle && imageCount > 0) {
    return null;
  }
  const media: LinkedInEmbedMedia = hasArticle
    ? 'article'
    : imageCount > 1
      ? 'image-grid'
      : imageCount === 1
        ? 'image'
        : 'none';
  return {
    commentary: extractCommentary(html),
    hasActivityHeader: testIds.includes(ACTIVITY_HEADER_TEST_ID),
    media,
  };
}

/** Width the commentary wraps at inside an iframe `frameWidth` px wide. */
export function linkedInCommentaryWidth(frameWidth: number): number {
  return Math.max(0, frameWidth - CARD_HORIZONTAL_INSET_PX);
}

/** Iframe height for a card whose commentary renders `commentaryHeight` px tall. */
export function estimateLinkedInEmbedHeight(
  layout: LinkedInEmbedLayout,
  commentaryHeight: number,
): number {
  const header = layout.hasActivityHeader ? ACTIVITY_HEADER_PX : 0;
  const media = layout.media === 'none' ? 0 : MEDIA_GAP_PX + MEDIA_HEIGHT_PX[layout.media];
  return Math.ceil(CARD_CHROME_PX + header + commentaryHeight + media + SAFETY_PX);
}

function asLayout(value: unknown): LinkedInEmbedLayout | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const rec = value as Record<string, unknown>;
  const media = rec.media;
  if (
    typeof rec.commentary !== 'string' ||
    typeof rec.hasActivityHeader !== 'boolean' ||
    typeof media !== 'string' ||
    !(media in MEDIA_HEIGHT_PX)
  ) {
    return null;
  }
  return {
    commentary: rec.commentary,
    hasActivityHeader: rec.hasActivityHeader,
    media: media as LinkedInEmbedMedia,
  };
}

const layoutRequests = new Map<string, Promise<LinkedInEmbedLayout | null>>();

/** Client fetch of the BFF layout; one request per URN for the page lifetime. */
export function fetchLinkedInEmbedLayout(urn: string): Promise<LinkedInEmbedLayout | null> {
  if (!isLinkedInEmbedUrn(urn)) {
    return Promise.resolve(null);
  }
  const cached = layoutRequests.get(urn);
  if (cached) {
    return cached;
  }
  const request = requestLinkedInEmbedLayout(urn);
  layoutRequests.set(urn, request);
  return request;
}

async function requestLinkedInEmbedLayout(urn: string): Promise<LinkedInEmbedLayout | null> {
  try {
    const res = await fetch(`/api/social-embed/linkedin?urn=${encodeURIComponent(urn)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { layout?: unknown };
    return asLayout(data.layout);
  } catch {
    return null;
  }
}
