import { ACTIVITY_NOTE_IMPORT_HASH_PARAM } from '../constants/activity-notes';
import { normalizeApiOrigin } from '../utils/waivio-api-urls';
import { normalizeActivityNoteBody } from './activity-note-body';

export type ActivityNoteImportLinkInput = {
  webOrigin: string;
  objectId: string;
  messageId: string;
  markdown: string;
};

export type ActivityNoteImportLink = {
  url: string;
  urlLength: number;
  bodyLength: number;
};

function requireSegment(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function encodeComponent(value: string, name: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    throw new Error(`${name} contains invalid Unicode (unpaired surrogate)`);
  }
}

/**
 * Builds the web link that opens an activity item with a note prefilled for import:
 * `{webOrigin}/object/{objectId}/social/activity/{messageId}#note={markdown}`.
 * The web reads the hash with `URLSearchParams` and saves only after the viewer confirms.
 */
export function buildActivityNoteImportLink(
  input: ActivityNoteImportLinkInput,
): ActivityNoteImportLink {
  const objectId = requireSegment(input.objectId, 'objectId');
  const messageId = requireSegment(input.messageId, 'messageId');
  const body = normalizeActivityNoteBody(input.markdown);

  const path = `/object/${encodeComponent(objectId, 'objectId')}/social/activity/${encodeComponent(messageId, 'messageId')}`;
  const hash = `#${ACTIVITY_NOTE_IMPORT_HASH_PARAM}=${encodeComponent(body, 'body')}`;
  const url = `${normalizeApiOrigin(input.webOrigin)}${path}${hash}`;

  return { url, urlLength: url.length, bodyLength: body.length };
}
