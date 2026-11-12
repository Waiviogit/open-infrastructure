import { markdownToPlainText } from '@opden-data-layer/common';

import { FEED_EXCERPT_MAX_LENGTH } from './feed.constants';

/**
 * Plain text of a post / comment / description body for a feed excerpt or SEO description:
 * markdown and HTML markup removed, spoilers hidden, whitespace collapsed to single spaces.
 */
export function stripHtmlForExcerpt(html: string): string {
  return markdownToPlainText(html);
}

export function truncateExcerpt(
  text: string,
  maxLen = FEED_EXCERPT_MAX_LENGTH,
): string {
  if (text.length <= maxLen) {
    return text;
  }
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return `${slice.slice(0, lastSpace)}…`;
  }
  return `${slice}…`;
}
