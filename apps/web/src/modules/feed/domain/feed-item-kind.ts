import type { FeedTab } from './feed-tab';

/** Profile tabs whose items are always replies (Hive comments, Leo threads). */
const REPLY_FEED_TABS: ReadonlySet<FeedTab> = new Set<FeedTab>([
  'comments',
  'threads',
]);

/**
 * True when a feed item is a comment or a thread rather than a root post. The query-api
 * `parentAuthor` decides; the tab covers items mapped without it.
 */
export function isReplyFeedItem(
  parentAuthor: string | null | undefined,
  feedTab: FeedTab | undefined,
): boolean {
  if (parentAuthor != null && parentAuthor.trim() !== '') {
    return true;
  }
  return feedTab != null && REPLY_FEED_TABS.has(feedTab);
}

/** True when the signed-in viewer wrote the item (case-insensitive Hive account match). */
export function viewerIsAuthor(
  viewer: string | null | undefined,
  author: string,
): boolean {
  if (viewer == null || viewer.trim() === '') {
    return false;
  }
  return viewer.trim().toLowerCase() === author.trim().toLowerCase();
}
