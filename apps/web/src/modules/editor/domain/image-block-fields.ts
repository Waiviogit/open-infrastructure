import { normalizeWebLinkUrl } from './link-url';

/** Longest alt text kept on an image block (legacy editor caption had no limit; Hive bodies stay readable). */
export const IMAGE_ALT_TEXT_MAX_LENGTH = 300;

/** `[` / `]` would end the markdown alt early; line breaks would split the image line. */
const ALT_TEXT_UNSAFE_CHARS = /[[\]\r\n\t]+/g;
const WHITESPACE_RUN = /\s{2,}/g;

/** One-line alt text that is safe inside `![…](…)`; empty string removes it. */
export function normalizeImageAltText(input: string): string {
  return input
    .replace(ALT_TEXT_UNSAFE_CHARS, ' ')
    .replace(WHITESPACE_RUN, ' ')
    .trim()
    .slice(0, IMAGE_ALT_TEXT_MAX_LENGTH)
    .trim();
}

/** Markdown for an image block: `![alt](src)`, wrapped as `[![alt](src)](href)` when linked. */
export function imageBlockMarkdown(src: string, altText: string, linkUrl: string): string {
  const image = `![${normalizeImageAltText(altText)}](${src})`;
  const href = linkUrl ? normalizeWebLinkUrl(linkUrl) : null;
  return href ? `[${image}](${encodeMarkdownUrl(href)})` : image;
}

/** `(`, `)` and spaces would end a markdown link destination early. */
function encodeMarkdownUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
}
