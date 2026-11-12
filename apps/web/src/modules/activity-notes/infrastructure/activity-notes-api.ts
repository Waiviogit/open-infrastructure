import type { QueryApiAuthedError } from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { ActivityNoteError } from '../domain/activity-note.types';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const LIMIT_REACHED_API_CODE = 'activity_notes_limit_reached';

export function activityNotesPath(messageId: string, noteId?: string): string {
  const base = `/query/v1/messages/${encodeURIComponent(messageId)}/notes`;
  return noteId ? `${base}/${encodeURIComponent(noteId)}` : base;
}

/** query-api failure → stable code the notes UI maps to an i18n message. */
export function mapActivityNoteError(error: QueryApiAuthedError): ActivityNoteError {
  if (error.code !== 'http_error') {
    return { code: error.code };
  }
  if (error.status === HTTP_UNAUTHORIZED) {
    return { code: 'unauthorized' };
  }
  if (error.status === HTTP_NOT_FOUND) {
    return { code: 'not_found' };
  }
  if (error.status === HTTP_CONFLICT && error.apiCode === LIMIT_REACHED_API_CODE) {
    return { code: 'limit_reached' };
  }
  if (error.status === HTTP_BAD_REQUEST) {
    return { code: 'invalid' };
  }
  return { code: 'http_error' };
}
