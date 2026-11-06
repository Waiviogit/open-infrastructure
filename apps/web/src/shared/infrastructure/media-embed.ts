import { parseVideoUrl, stripUrlTruncation } from './video-preview';

export type MediaEmbedProvider =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'linkedin';

export type ParsedMediaEmbed = {
  provider: MediaEmbedProvider;
  embedSrc: string;
  wrapperClass: string;
  title: string;
};

const YOUTUBE_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const TIKTOK_IFRAME_ALLOW =
  'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';

const FACEBOOK_IFRAME_ALLOW =
  'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';

const TRAILING_PUNCTUATION = /[).,;!?]+$/;

function decodeHtmlEntities(url: string): string {
  return url.replace(/&amp;/gi, '&');
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(TRAILING_PUNCTUATION, '');
}

/** Canonical https URL for storage / markdown. */
export function canonicalizeMediaUrl(url: string): string {
  const trimmed = stripTrailingPunctuation(
    stripUrlTruncation(decodeHtmlEntities(url.trim())),
  );
  if (trimmed === '') {
    return '';
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Detects Instagram / YouTube / TikTok / Facebook / X / LinkedIn video URLs.
 * Profile URLs like instagram.com/username return null.
 */
export function parseMediaEmbedUrl(url: string): ParsedMediaEmbed | null {
  const normalized = canonicalizeMediaUrl(url);
  if (normalized === '') {
    return null;
  }

  const parsed = parseVideoUrl(normalized);
  if (!parsed) {
    return null;
  }

  if (parsed.provider === 'instagram') {
    return {
      provider: 'instagram',
      embedSrc: parsed.embedUrl,
      wrapperClass: 'blog-post-instagram-embed',
      title: 'Instagram post',
    };
  }
  if (parsed.provider === 'youtube') {
    return {
      provider: 'youtube',
      embedSrc: parsed.embedUrl,
      wrapperClass:
        parsed.layout === 'portrait'
          ? 'blog-post-youtube-embed blog-post-youtube-embed--portrait'
          : 'blog-post-youtube-embed',
      title: 'YouTube video',
    };
  }
  if (parsed.provider === 'tiktok') {
    return {
      provider: 'tiktok',
      embedSrc: parsed.embedUrl,
      wrapperClass: 'blog-post-tiktok-embed',
      title: 'TikTok video',
    };
  }
  if (parsed.provider === 'facebook') {
    return {
      provider: 'facebook',
      embedSrc: parsed.embedUrl,
      wrapperClass:
        parsed.layout === 'portrait'
          ? 'blog-post-facebook-embed blog-post-facebook-embed--portrait'
          : 'blog-post-facebook-embed',
      title: 'Facebook video',
    };
  }
  if (parsed.provider === 'x') {
    return {
      provider: 'x',
      embedSrc: parsed.embedUrl,
      wrapperClass: 'blog-post-x-embed',
      title: 'X post',
    };
  }
  if (parsed.provider === 'linkedin') {
    return {
      provider: 'linkedin',
      embedSrc: parsed.embedUrl,
      wrapperClass: 'blog-post-linkedin-embed',
      title: 'LinkedIn post',
    };
  }

  return null;
}

/** True when `url` is already a provider embed src (do not wrap again). */
export function isProviderEmbedSrc(url: string): boolean {
  return /(?:youtube(?:-nocookie)?\.com\/embed\/|instagram\.com\/(?:p|reel|tv)\/[^/]+\/embed|tiktok\.com\/(?:player\/v1|embed\/v2)\/|facebook\.com\/plugins\/video\.php|platform\.twitter\.com\/embed\/Tweet\.html|linkedin\.com\/embed\/feed\/update\/)/i.test(
    url,
  );
}

const YOUTUBE_EMBED_SRC = /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})\b/i;
const INSTAGRAM_EMBED_SRC = /instagram\.com\/(p|reels?|tv)\/([A-Za-z0-9_-]+)\/embed\b/i;
const X_EMBED_SRC = /platform\.twitter\.com\/embed\/Tweet\.html\?[^#\s]*\bid=(\d{10,20})/i;
const LINKEDIN_EMBED_SRC = /linkedin\.com\/embed\/(feed\/update\/urn:li:[A-Za-z]+:\d{10,20})/i;
const FACEBOOK_PLUGIN_SRC = /facebook\.com\/plugins\/video\.php/i;
const THREE_SPEAK_PLAYER_SRC = /play\.3speak\.tv\/(?:watch|embed)\?[^#\s]*\bv=([^&#\s]+)/i;
const VIMEO_PLAYER_SRC = /player\.vimeo\.com\/video\/(\d+)(?:\?[^#\s]*\bh=([A-Za-z0-9]+))?/i;

/**
 * Public page URL for a provider iframe `src` (the reverse of `embedSrc`), so an
 * embed copied out of a rendered post can be stored as the link an author would
 * paste. `portrait` picks the Shorts URL for a portrait YouTube player. Returns
 * `null` for anything that is not a known player.
 */
export function mediaUrlFromEmbedSrc(
  src: string,
  options: { portrait?: boolean } = {},
): string | null {
  const url = canonicalizeMediaUrl(src);
  if (url === '') {
    return null;
  }
  const youtube = url.match(YOUTUBE_EMBED_SRC);
  if (youtube) {
    return options.portrait
      ? `https://www.youtube.com/shorts/${youtube[1]}`
      : `https://www.youtube.com/watch?v=${youtube[1]}`;
  }
  const instagram = url.match(INSTAGRAM_EMBED_SRC);
  if (instagram) {
    return `https://www.instagram.com/${instagram[1]}/${instagram[2]}/`;
  }
  const x = url.match(X_EMBED_SRC);
  if (x) {
    return `https://x.com/i/status/${x[1]}`;
  }
  const linkedin = url.match(LINKEDIN_EMBED_SRC);
  if (linkedin) {
    return `https://www.linkedin.com/${linkedin[1]}`;
  }
  if (FACEBOOK_PLUGIN_SRC.test(url)) {
    const href = facebookPluginHref(url);
    return href && parseMediaEmbedUrl(href) ? href : null;
  }
  const threeSpeak = url.match(THREE_SPEAK_PLAYER_SRC);
  if (threeSpeak) {
    return `https://3speak.tv/watch?v=${threeSpeak[1]}`;
  }
  const vimeo = url.match(VIMEO_PLAYER_SRC);
  if (vimeo) {
    return vimeo[2] ? `https://vimeo.com/${vimeo[1]}/${vimeo[2]}` : `https://vimeo.com/${vimeo[1]}`;
  }
  // TikTok players carry no author handle; the player URL itself parses as a video.
  return parseMediaEmbedUrl(url) ? url : null;
}

function facebookPluginHref(url: string): string | null {
  try {
    const href = new URL(url).searchParams.get('href')?.trim() ?? '';
    return /^https?:\/\//i.test(href) ? href : null;
  } catch {
    return null;
  }
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function mediaEmbedIframeHtml(parsed: ParsedMediaEmbed): string {
  const src = escapeHtmlAttr(parsed.embedSrc);
  const title = escapeHtmlAttr(parsed.title);
  if (parsed.provider === 'youtube') {
    return `<div class="${parsed.wrapperClass}"><iframe src="${src}" title="${title}" frameborder="0" allow="${YOUTUBE_IFRAME_ALLOW}" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (parsed.provider === 'tiktok') {
    return `<div class="${parsed.wrapperClass}"><iframe src="${src}" title="${title}" frameborder="0" allow="${TIKTOK_IFRAME_ALLOW}" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (parsed.provider === 'facebook') {
    return `<div class="${parsed.wrapperClass}"><iframe src="${src}" title="${title}" frameborder="0" allow="${FACEBOOK_IFRAME_ALLOW}" allowfullscreen loading="lazy" scrolling="no"></iframe></div>`;
  }
  return `<div class="${parsed.wrapperClass}"><iframe src="${src}" title="${title}" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe></div>`;
}
