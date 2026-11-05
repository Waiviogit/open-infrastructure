/** Max object links attached from one paste (keeps the by-ids lookup bounded). */
export const PASTED_OBJECT_IDS_MAX = 20;

const OBJECT_PATH_REGEX = /\/object\/([^/?#\s"'<>]+)/g;
const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi;
const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"']+|(?:^|\s)(\/object\/[^\s<>"']+)/g;

function objectIdsFromUrl(url: string, into: Set<string>): void {
  for (const match of url.matchAll(OBJECT_PATH_REGEX)) {
    const raw = match[1];
    if (!raw) {
      continue;
    }
    let id: string;
    try {
      id = decodeURIComponent(raw).trim();
    } catch {
      continue;
    }
    if (id) {
      into.add(id);
    }
  }
}

/**
 * Object ids from links in pasted content (`…/object/<id>`, any host — unknown
 * ids are dropped later by the by-ids lookup). HTML `href`s first, then URLs in
 * plain text. Order of first appearance, deduplicated, capped.
 */
export function extractPastedObjectIds(html: string | null, text: string | null): string[] {
  const ids = new Set<string>();
  if (html) {
    for (const match of html.matchAll(HREF_REGEX)) {
      objectIdsFromUrl(match[1] ?? '', ids);
    }
  }
  if (text) {
    for (const match of text.matchAll(URL_IN_TEXT_REGEX)) {
      objectIdsFromUrl(match[1] ?? match[0], ids);
    }
  }
  return [...ids].slice(0, PASTED_OBJECT_IDS_MAX);
}
