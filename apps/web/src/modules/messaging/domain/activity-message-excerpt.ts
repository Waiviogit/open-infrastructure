import { stripImageMarkupFromMessageBody } from './messaging.helpers';

/** Meta description length for an activity message permalink. */
export const ACTIVITY_MESSAGE_EXCERPT_MAX_CHARS = 160;

const MARKDOWN_LINK_RE = /\[([^\]]*)]\([^)]*\)/g;
const HTML_TAG_RE = /<[^>]+>/g;
const MARKDOWN_MARKUP_RE = /[*_`>#~]+/g;
const WHITESPACE_RE = /\s+/g;

/** Plain-text excerpt of a markdown message body (link text kept, markup dropped). `null` when empty. */
export function buildActivityMessageExcerpt(
  body: string | null,
  maxChars: number = ACTIVITY_MESSAGE_EXCERPT_MAX_CHARS,
): string | null {
  if (!body) {
    return null;
  }
  const text = stripImageMarkupFromMessageBody(body)
    .replace(MARKDOWN_LINK_RE, '$1')
    .replace(HTML_TAG_RE, ' ')
    .replace(MARKDOWN_MARKUP_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim();
  if (!text) {
    return null;
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
