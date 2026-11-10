import type { MessageItem } from './messaging.types';

/** Object Activity feed path (`/object/:id/social/activity`). */
export function buildObjectActivityFeedPath(objectId: string): string {
  return `/object/${encodeURIComponent(objectId)}/social/activity`;
}

/**
 * Public permalink of one object activity message. Proxy rewrites it to the object page
 * (`?tab=social&social_sub=activity&activity_message_id=`); in a feed it opens the preview modal.
 */
export function buildObjectActivityMessagePath(objectId: string, messageId: string): string {
  return `${buildObjectActivityFeedPath(objectId)}/${encodeURIComponent(messageId)}`;
}

const ACTIVITY_MESSAGE_PATH_RE = /^\/object\/[^/]+\/social\/activity\/[^/]+\/?$/;

/** `true` for `/object/:id/social/activity/:messageId` (permalink page or preview modal URL). */
export function isObjectActivityMessagePath(pathname: string): boolean {
  return ACTIVITY_MESSAGE_PATH_RE.test(pathname);
}

/**
 * Permalink for a feed row. `contextObjectId` is the object whose feed renders the row;
 * without it (home feed) the row's own object (`source_object`) is used. `null` = no permalink.
 */
export function resolveActivityMessageHref(
  message: Pick<MessageItem, 'message_id' | 'source_object'>,
  contextObjectId?: string | null,
): string | null {
  const objectId = contextObjectId?.trim() || message.source_object?.object_id?.trim();
  const messageId = message.message_id.trim();
  if (!objectId || !messageId) {
    return null;
  }
  return buildObjectActivityMessagePath(objectId, messageId);
}
