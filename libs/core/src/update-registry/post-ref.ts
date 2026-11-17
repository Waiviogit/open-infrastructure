import { isHiveAccountName, normalizeHiveAccountInput } from '@opden-data-layer/common';

/** Hive `HIVE_MAX_PERMLINK_LENGTH` (permlink must be shorter than this). */
export const HIVE_PERMLINK_MAX_LENGTH = 256;

/** Longest `author/permlink` value accepted by `pin` / `remove` updates. */
export const POST_REF_MAX_LENGTH = 16 + 1 + HIVE_PERMLINK_MAX_LENGTH;

const POST_REF_SEPARATOR = '/';
const PERMLINK_FORBIDDEN_CHARS = /[\s/?#]/;
/** `…/@author/permlink…` inside a post URL or path. */
const POST_PATH_PATTERN = /@([^/?#\s]+)\/([^/?#\s]+)/;

export interface PostRef {
  author: string;
  permlink: string;
}

function isPermlink(permlink: string): boolean {
  return (
    permlink.length > 0 &&
    permlink.length < HIVE_PERMLINK_MAX_LENGTH &&
    !PERMLINK_FORBIDDEN_CHARS.test(permlink)
  );
}

function toPostRef(author: string, permlink: string): PostRef | null {
  if (!isHiveAccountName(author) || !isPermlink(permlink)) {
    return null;
  }
  return { author, permlink };
}

/**
 * Strict parse of a stored `author/permlink` value (`pin` / `remove` update body).
 * Returns null for anything that is not a valid Hive account followed by one permlink segment.
 */
export function parsePostRef(raw: string): PostRef | null {
  const trimmed = raw.trim();
  const slash = trimmed.indexOf(POST_REF_SEPARATOR);
  if (slash <= 0) {
    return null;
  }
  return toPostRef(trimmed.slice(0, slash), trimmed.slice(slash + 1));
}

export function formatPostRef(ref: PostRef): string {
  return `${ref.author}${POST_REF_SEPARATOR}${ref.permlink}`;
}

export function isPostRef(raw: string): boolean {
  return parsePostRef(raw) != null;
}

/**
 * User input → canonical `author/permlink`, or null when it does not name a post.
 * Accepts a post URL or path with `/@author/permlink`, `@author/permlink` or `author/permlink`.
 */
export function postRefFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const pathMatch = POST_PATH_PATTERN.exec(trimmed);
  if (pathMatch) {
    const ref = toPostRef(normalizeHiveAccountInput(pathMatch[1]), pathMatch[2]);
    return ref ? formatPostRef(ref) : null;
  }

  const slash = trimmed.indexOf(POST_REF_SEPARATOR);
  if (slash <= 0) {
    return null;
  }
  const ref = toPostRef(
    normalizeHiveAccountInput(trimmed.slice(0, slash)),
    trimmed.slice(slash + 1).trim(),
  );
  return ref ? formatPostRef(ref) : null;
}
