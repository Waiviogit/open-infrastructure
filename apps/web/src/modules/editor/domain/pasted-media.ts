import { extractCidFromContentGatewayUrl } from '@/config/ipfs-content-url';
import { stripHiveImageProxyPrefix } from '@/shared/infrastructure/image/get-proxy-image-url';
import {
  mediaUrlFromEmbedSrc,
  parseMediaEmbedUrl,
} from '@/shared/infrastructure/media-embed';

import type { ImagePayload } from './nodes/image-node';

const HTTP_URL = /^https?:\/\//i;
/** Wrapper class the post renderer gives portrait (Shorts) YouTube players. */
const PORTRAIT_EMBED_WRAPPER = /youtube-embed--portrait/;

/**
 * Image block for a pasted `<img>`: the original URL, not our display proxy. The
 * post renderer keeps the author's URL in `data-fallback-src`; other Hive fronts
 * use a bare `images.hive.blog/0x0/` prefix. `null` for inline data / relative
 * sources that cannot be published.
 */
export function pastedImagePayload(img: HTMLImageElement): ImagePayload | null {
  const raw = (
    img.getAttribute('data-fallback-src') ||
    img.getAttribute('src') ||
    ''
  ).trim();
  if (!HTTP_URL.test(raw)) {
    return null;
  }
  const src = stripHiveImageProxyPrefix(raw);
  return {
    src,
    altText: img.getAttribute('alt')?.trim() ?? '',
    cid: extractCidFromContentGatewayUrl(src) ?? '',
  };
}

function isPortraitEmbed(iframe: HTMLIFrameElement): boolean {
  return PORTRAIT_EMBED_WRAPPER.test(iframe.parentElement?.className ?? '');
}

/** Public URL of a pasted player iframe, for any known provider (3Speak, Vimeo included). */
export function pastedEmbedPageUrl(iframe: HTMLIFrameElement): string | null {
  const src = iframe.getAttribute('src')?.trim() ?? '';
  if (!src) {
    return null;
  }
  return mediaUrlFromEmbedSrc(src, { portrait: isPortraitEmbed(iframe) });
}

/** Video block URL for a pasted iframe the editor can embed; `null` otherwise. */
export function pastedVideoUrl(iframe: HTMLIFrameElement): string | null {
  const url = pastedEmbedPageUrl(iframe);
  return url && parseMediaEmbedUrl(url) ? url : null;
}
