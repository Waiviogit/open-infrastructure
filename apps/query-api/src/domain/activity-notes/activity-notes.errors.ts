/** The activity message does not exist (or was deleted). */
export class ActivityMessageNotFoundError extends Error {
  constructor(readonly messageId: string) {
    super('activity_message_not_found');
    this.name = 'ActivityMessageNotFoundError';
  }
}

/** No note with this id belongs to the caller on this message. */
export class ActivityNoteNotFoundError extends Error {
  constructor(readonly noteId: string) {
    super('activity_note_not_found');
    this.name = 'ActivityNoteNotFoundError';
  }
}

/** The caller already keeps the maximum number of notes on this message. */
export class ActivityNotesLimitReachedError extends Error {
  constructor(readonly limit: number) {
    super('activity_notes_limit_reached');
    this.name = 'ActivityNotesLimitReachedError';
  }
}
