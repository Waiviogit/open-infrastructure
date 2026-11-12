import { objectPagePath } from '@/shared/routes/object-page-path';

/** Leo `extractHashtags` only captures `#([\w-]+)` — ids with `.` need `/object/` fallback. */
const HASHTAG_SAFE_OBJECT_ID = /^[\w-]+$/;

function buildObjectAnchorSuffix(objectId: string): string {
  if (HASHTAG_SAFE_OBJECT_ID.test(objectId)) {
    return `#${objectId}`;
  }
  return objectPagePath(objectId);
}

function bodyAlreadyAnchorsObject(body: string, objectId: string): boolean {
  const lowerBody = body.toLowerCase();
  const lowerId = objectId.toLowerCase();

  return (
    lowerBody.includes(`#${lowerId}`) ||
    lowerBody.includes(objectPagePath(objectId).toLowerCase()) ||
    lowerBody.includes(`/object/${lowerId}`)
  );
}

/**
 * Appends an object anchor so chain-indexer {@link extractHashtags} indexes the object id.
 * Prefers `#object_id` for word-safe ids; falls back to `/object/{id}` when the id contains `.`.
 * Skips when the body already references the object.
 */
export function appendObjectAnchorToThreadBody(
  body: string,
  objectId: string,
): string {
  const trimmed = body.trim();
  const id = objectId.trim();
  if (!id) {
    return trimmed;
  }

  if (bodyAlreadyAnchorsObject(trimmed, id)) {
    return trimmed;
  }

  const anchor = buildObjectAnchorSuffix(id);
  if (trimmed === '') {
    return anchor;
  }

  return `${trimmed}\n\n${anchor}`;
}

const TRAILING_HASHTAG_ANCHOR = /^#([\w-]+)$/;
const TRAILING_PATH_ANCHOR = /^\/object\/([^\s/]+)$/;

function decodeObjectPathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Object id of the anchor {@link appendObjectAnchorToThreadBody} put on its own last paragraph
 * (`#object_id` or `/object/{id}`), or `null`. An edit re-applies it so the thread stays on
 * the object's feed.
 */
export function extractTrailingObjectAnchorId(body: string): string | null {
  const paragraphs = body.trim().split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1]?.trim() ?? '';
  const hashtag = TRAILING_HASHTAG_ANCHOR.exec(last);
  if (hashtag) {
    return hashtag[1];
  }
  const path = TRAILING_PATH_ANCHOR.exec(last);
  return path ? decodeObjectPathSegment(path[1]) : null;
}
