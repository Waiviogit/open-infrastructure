import { z } from 'zod';

import {
  ACTIVITY_MESSAGE_ID_MAX_CHARS,
  ACTIVITY_NOTE_BODY_MAX_CHARS,
  ACTIVITY_NOTES_MAX_PER_MESSAGE,
} from '../domain/activity-notes';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const unauthorizedSchema = z.object({
  statusCode: z.literal(401),
  message: z.string(),
  error: z.string(),
});

const badRequestSchema = z.object({
  message: z.string(),
  issues: z.unknown(),
});

const codedErrorSchema = (code: string) =>
  z.object({
    message: z.string(),
    code: z.literal(code),
  });

const activityNoteViewSchema = registry.register(
  'ActivityNoteView',
  z.object({
    noteId: z.string().uuid(),
    messageId: z.string(),
    body: z.string().describe('Markdown body.'),
    createdAt: z.string().describe('ISO 8601 timestamp.'),
    updatedAt: z.string().describe('ISO 8601 timestamp.'),
  }),
);

const activityNoteListResponseSchema = registry.register(
  'ActivityNoteListResponse',
  z.object({
    items: z
      .array(activityNoteViewSchema)
      .describe('Caller notes, oldest first.'),
    limit: z
      .number()
      .int()
      .describe(`Max notes per message (${ACTIVITY_NOTES_MAX_PER_MESSAGE}).`),
  }),
);

const messageIdParam = z
  .string()
  .min(1)
  .max(ACTIVITY_MESSAGE_ID_MAX_CHARS)
  .openapi({
    param: { name: 'messageId', in: 'path', required: true },
    description: 'Activity message id (`messages.message_id`).',
  });

const noteIdParam = z
  .string()
  .uuid()
  .openapi({
    param: { name: 'noteId', in: 'path', required: true },
    description: 'Note id (UUID).',
  });

const noteBody = z.object({
  body: z
    .string()
    .min(1)
    .max(ACTIVITY_NOTE_BODY_MAX_CHARS)
    .describe('Markdown; trimmed before validation.'),
});

const bearerSecurity = [{ bearerAuth: [] }];
const path = '/query/v1/messages/{messageId}/notes';
const notePath = `${path}/{noteId}`;

const unauthorizedResponse = {
  description: 'Missing or invalid Bearer token.',
  content: { 'application/json': { schema: unauthorizedSchema } },
};

const badRequestResponse = {
  description: 'Invalid path params or body.',
  content: { 'application/json': { schema: badRequestSchema } },
};

const noteNotFoundResponse = {
  description: 'No note with this id belongs to the caller on this message.',
  content: {
    'application/json': { schema: codedErrorSchema('activity_note_not_found') },
  },
};

registry.registerPath({
  method: 'get',
  path,
  tags: [queryApiOpenApiTags.activityMessageNotes],
  summary: 'List my notes on an activity message',
  description:
    'Only notes of the JWT subject. Unknown message ids return an empty list (no 404).',
  security: bearerSecurity,
  request: { params: z.object({ messageId: messageIdParam }) },
  responses: {
    200: {
      description: 'Caller notes.',
      content: {
        'application/json': { schema: activityNoteListResponseSchema },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'post',
  path,
  tags: [queryApiOpenApiTags.activityMessageNotes],
  summary: 'Create a note on an activity message',
  description: `At most ${ACTIVITY_NOTES_MAX_PER_MESSAGE} notes per account per message.`,
  security: bearerSecurity,
  request: {
    params: z.object({ messageId: messageIdParam }),
    body: { content: { 'application/json': { schema: noteBody } } },
  },
  responses: {
    201: {
      description: 'Created note.',
      content: { 'application/json': { schema: activityNoteViewSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: {
      description: 'Activity message not found.',
      content: {
        'application/json': {
          schema: codedErrorSchema('activity_message_not_found'),
        },
      },
    },
    409: {
      description:
        'Caller already has the maximum number of notes on this message.',
      content: {
        'application/json': {
          schema: codedErrorSchema('activity_notes_limit_reached'),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path,
  tags: [queryApiOpenApiTags.activityMessageNotes],
  summary: 'Delete all my notes on an activity message',
  description: 'Returns 204 even when the caller has no notes on the message.',
  security: bearerSecurity,
  request: { params: z.object({ messageId: messageIdParam }) },
  responses: {
    204: { description: 'Deleted.' },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'patch',
  path: notePath,
  tags: [queryApiOpenApiTags.activityMessageNotes],
  summary: 'Edit a note body',
  security: bearerSecurity,
  request: {
    params: z.object({ messageId: messageIdParam, noteId: noteIdParam }),
    body: { content: { 'application/json': { schema: noteBody } } },
  },
  responses: {
    200: {
      description: 'Updated note.',
      content: { 'application/json': { schema: activityNoteViewSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: noteNotFoundResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: notePath,
  tags: [queryApiOpenApiTags.activityMessageNotes],
  summary: 'Delete one note',
  security: bearerSecurity,
  request: {
    params: z.object({ messageId: messageIdParam, noteId: noteIdParam }),
  },
  responses: {
    204: { description: 'Deleted.' },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: noteNotFoundResponse,
  },
});
