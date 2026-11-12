import 'server-only';

import { fail, ok, type Result } from '@/shared/domain/result';
import { queryApiAuthedFetch } from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { ActivityNoteError, ActivityNoteList } from '../domain/activity-note.types';
import { activityNoteListSchema } from '../domain/activity-note.schemas';
import { ACTIVITY_NOTES_MAX_PER_MESSAGE } from '../domain/activity-notes.constants';
import { activityNotesPath, mapActivityNoteError } from './activity-notes-api';

const EMPTY_LIST: ActivityNoteList = { items: [], limit: ACTIVITY_NOTES_MAX_PER_MESSAGE };

/**
 * The viewer's own notes on one activity message (request-time, never cached).
 * A missing or rejected token resolves to an empty list: notes are private, there is nothing to show.
 */
export async function fetchActivityNotesServer(
  messageId: string,
): Promise<Result<ActivityNoteList, ActivityNoteError>> {
  const result = await queryApiAuthedFetch<unknown>(activityNotesPath(messageId), {
    method: 'GET',
  });
  if (!result.ok) {
    const error = mapActivityNoteError(result.error);
    return error.code === 'unauthorized' ? ok(EMPTY_LIST) : fail(error);
  }
  const parsed = activityNoteListSchema.safeParse(result.value);
  return parsed.success ? ok(parsed.data) : fail({ code: 'http_error' });
}
