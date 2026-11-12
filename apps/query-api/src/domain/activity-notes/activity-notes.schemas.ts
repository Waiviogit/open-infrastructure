import { z } from 'zod';

import {
  ACTIVITY_MESSAGE_ID_MAX_CHARS,
  ACTIVITY_NOTE_BODY_MAX_CHARS,
} from './activity-notes.constants';

const messageIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(ACTIVITY_MESSAGE_ID_MAX_CHARS);

/** Route params for `messages/:messageId/notes`. */
export const activityNotesMessageParamsSchema = z
  .object({ messageId: messageIdSchema })
  .strict();

export type ActivityNotesMessageParams = z.infer<
  typeof activityNotesMessageParamsSchema
>;

/** Route params for `messages/:messageId/notes/:noteId`. */
export const activityNoteParamsSchema = z
  .object({
    messageId: messageIdSchema,
    noteId: z.uuid(),
  })
  .strict();

export type ActivityNoteParams = z.infer<typeof activityNoteParamsSchema>;

/** Body for create and update. */
export const activityNoteBodySchema = z
  .object({
    body: z.string().trim().min(1).max(ACTIVITY_NOTE_BODY_MAX_CHARS),
  })
  .strict();

export type ActivityNoteBody = z.infer<typeof activityNoteBodySchema>;

export const activityNoteViewSchema = z
  .object({
    noteId: z.string(),
    messageId: z.string(),
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type ActivityNoteView = z.infer<typeof activityNoteViewSchema>;

export const activityNoteListResponseSchema = z
  .object({
    items: z.array(activityNoteViewSchema),
    limit: z.number().int(),
  })
  .strict();

export type ActivityNoteListResponse = z.infer<
  typeof activityNoteListResponseSchema
>;
