'use server';

import { z } from 'zod';

import { fail, ok, type Result } from '@/shared/domain/result';
import { queryApiAuthedFetch } from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { ActivityNote, ActivityNoteError } from '../domain/activity-note.types';
import { activityNoteBodySchema, activityNoteSchema } from '../domain/activity-note.schemas';
import { activityNotesPath, mapActivityNoteError } from './activity-notes-api';

/** Matches query-api / chain-indexer message id rule. */
const MESSAGE_ID_MAX_CHARS = 256;

const messageIdSchema = z.string().trim().min(1).max(MESSAGE_ID_MAX_CHARS);
const noteIdSchema = z.uuid();

type NoteResult<T> = Promise<Result<T, ActivityNoteError>>;

function parseNote(value: unknown): Result<ActivityNote, ActivityNoteError> {
  const parsed = activityNoteSchema.safeParse(value);
  return parsed.success ? ok(parsed.data) : fail({ code: 'http_error' });
}

export async function createActivityNoteAction(
  messageId: string,
  body: string,
): NoteResult<ActivityNote> {
  const id = messageIdSchema.safeParse(messageId);
  const text = activityNoteBodySchema.safeParse(body);
  if (!id.success || !text.success) {
    return fail({ code: 'invalid' });
  }
  const result = await queryApiAuthedFetch<unknown>(activityNotesPath(id.data), {
    method: 'POST',
    body: JSON.stringify({ body: text.data }),
  });
  return result.ok ? parseNote(result.value) : fail(mapActivityNoteError(result.error));
}

export async function updateActivityNoteAction(
  messageId: string,
  noteId: string,
  body: string,
): NoteResult<ActivityNote> {
  const id = messageIdSchema.safeParse(messageId);
  const note = noteIdSchema.safeParse(noteId);
  const text = activityNoteBodySchema.safeParse(body);
  if (!id.success || !note.success || !text.success) {
    return fail({ code: 'invalid' });
  }
  const result = await queryApiAuthedFetch<unknown>(activityNotesPath(id.data, note.data), {
    method: 'PATCH',
    body: JSON.stringify({ body: text.data }),
  });
  return result.ok ? parseNote(result.value) : fail(mapActivityNoteError(result.error));
}

export async function deleteActivityNoteAction(
  messageId: string,
  noteId: string,
): NoteResult<null> {
  const id = messageIdSchema.safeParse(messageId);
  const note = noteIdSchema.safeParse(noteId);
  if (!id.success || !note.success) {
    return fail({ code: 'invalid' });
  }
  const result = await queryApiAuthedFetch<void>(activityNotesPath(id.data, note.data), {
    method: 'DELETE',
  });
  return result.ok ? ok(null) : fail(mapActivityNoteError(result.error));
}

export async function deleteAllActivityNotesAction(messageId: string): NoteResult<null> {
  const id = messageIdSchema.safeParse(messageId);
  if (!id.success) {
    return fail({ code: 'invalid' });
  }
  const result = await queryApiAuthedFetch<void>(activityNotesPath(id.data), {
    method: 'DELETE',
  });
  return result.ok ? ok(null) : fail(mapActivityNoteError(result.error));
}
