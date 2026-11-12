/** One private note as query-api returns it (`NoteView`). `body` is markdown. */
export type ActivityNote = {
  noteId: string;
  messageId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

/** `GET /query/v1/messages/:messageId/notes` — the viewer's own notes, oldest first. */
export type ActivityNoteList = {
  items: ActivityNote[];
  limit: number;
};

export type ActivityNoteErrorCode =
  | 'unauthorized'
  | 'limit_reached'
  | 'not_found'
  | 'invalid'
  | 'network'
  | 'http_error';

export type ActivityNoteError = { code: ActivityNoteErrorCode };
