import type { ActivityNoteErrorCode } from '../domain/activity-note.types';

/** Stable action error code → i18n key shown in the notes UI. */
export function activityNoteErrorMessageKey(code: ActivityNoteErrorCode): string {
  switch (code) {
    case 'limit_reached':
      return 'activity_notes_limit_reached';
    case 'unauthorized':
      return 'activity_notes_import_login';
    default:
      return 'activity_notes_error';
  }
}
