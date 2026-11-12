import { ACTIVITY_NOTE_BODY_MAX_LENGTH } from '../constants/activity-notes';

/** Trims a note body and enforces the shared 1..20000 character limit. */
export function normalizeActivityNoteBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('Note body is empty');
  }
  if (trimmed.length > ACTIVITY_NOTE_BODY_MAX_LENGTH) {
    throw new Error(
      `Note body is ${trimmed.length} characters; the limit is ${ACTIVITY_NOTE_BODY_MAX_LENGTH}. Shorten it or split it into several notes.`,
    );
  }
  return trimmed;
}
