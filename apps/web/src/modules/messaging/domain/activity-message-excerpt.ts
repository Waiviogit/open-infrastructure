import { markdownToPlainText } from '@opden-data-layer/common';

/** Meta description length for an activity message permalink. */
export const ACTIVITY_MESSAGE_EXCERPT_MAX_CHARS = 160;

/** Plain-text excerpt of a markdown message body (link text kept, markup dropped). `null` when empty. */
export function buildActivityMessageExcerpt(
  body: string | null,
  maxChars: number = ACTIVITY_MESSAGE_EXCERPT_MAX_CHARS,
): string | null {
  if (!body) {
    return null;
  }
  const text = markdownToPlainText(body);
  if (!text) {
    return null;
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
