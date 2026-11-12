import { z } from 'zod';

import { ACTIVITY_NOTE_BODY_MAX_CHARS } from './activity-notes.constants';

/** Same rule as query-api: trimmed, 1..{@link ACTIVITY_NOTE_BODY_MAX_CHARS} chars. */
export const activityNoteBodySchema = z.string().trim().min(1).max(ACTIVITY_NOTE_BODY_MAX_CHARS);

export const activityNoteSchema = z.object({
  noteId: z.string().min(1),
  messageId: z.string().min(1),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const activityNoteListSchema = z.object({
  items: z.array(activityNoteSchema),
  limit: z.number().int().positive(),
});
