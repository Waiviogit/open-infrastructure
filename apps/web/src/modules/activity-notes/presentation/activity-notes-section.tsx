'use client';

import { useCallback, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { Result } from '@/shared/domain/result';

import type {
  ActivityNote,
  ActivityNoteError,
  ActivityNoteErrorCode,
} from '../domain/activity-note.types';
import {
  createActivityNoteAction,
  deleteActivityNoteAction,
  deleteAllActivityNotesAction,
  updateActivityNoteAction,
} from '../infrastructure/activity-notes.actions';
import { ActivityNoteCard } from './activity-note-card';
import { ActivityNoteComposer } from './activity-note-composer';
import { activityNoteErrorMessageKey } from './activity-note-error-message';
import { DeleteAllActivityNotesModal } from './delete-all-activity-notes-modal';

export type ActivityNotesUpdater = (previous: ActivityNote[]) => ActivityNote[];

export type ActivityNotesSectionProps = {
  messageId: string;
  /** Signed-in owner of the notes. */
  viewerUsername: string;
  notes: ActivityNote[];
  limit: number;
  /** The server could not load the notes (list shown empty, with an alert). */
  loadFailed?: boolean;
  onNotesChange: (update: ActivityNotesUpdater) => void;
};

/** The viewer's private notes on one activity message: list, add, edit, delete, delete all. */
export function ActivityNotesSection({
  messageId,
  viewerUsername,
  notes,
  limit,
  loadFailed = false,
  onNotesChange,
}: ActivityNotesSectionProps) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<ActivityNoteErrorCode | null>(
    loadFailed ? 'http_error' : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  /** Runs one Server Action; a rejected call (500, offline) becomes a `network` error. */
  const run = useCallback(
    async <T,>(
      action: () => Promise<Result<T, ActivityNoteError>>,
      onSuccess: (value: T) => void,
    ): Promise<boolean> => {
      setPending(true);
      setErrorCode(null);
      try {
        const result = await action();
        if (!result.ok) {
          setErrorCode(result.error.code);
          return false;
        }
        onSuccess(result.value);
        return true;
      } catch {
        setErrorCode('network');
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const handleCreate = useCallback(
    (body: string) =>
      run(
        () => createActivityNoteAction(messageId, body),
        (note) => onNotesChange((previous) => [...previous, note]),
      ),
    [messageId, onNotesChange, run],
  );

  const handleUpdate = useCallback(
    (noteId: string, body: string) =>
      run(
        () => updateActivityNoteAction(messageId, noteId, body),
        (note) => {
          onNotesChange((previous) =>
            previous.map((item) => (item.noteId === note.noteId ? note : item)),
          );
          setEditingId(null);
        },
      ),
    [messageId, onNotesChange, run],
  );

  const handleDelete = useCallback(
    (noteId: string) =>
      void run(
        () => deleteActivityNoteAction(messageId, noteId),
        () => onNotesChange((previous) => previous.filter((item) => item.noteId !== noteId)),
      ),
    [messageId, onNotesChange, run],
  );

  const handleDeleteAll = useCallback(async () => {
    const deleted = await run(
      () => deleteAllActivityNotesAction(messageId),
      () => {
        onNotesChange(() => []);
        setEditingId(null);
      },
    );
    if (deleted) {
      setConfirmDeleteAll(false);
    }
  }, [messageId, onNotesChange, run]);

  const atLimit = notes.length >= limit;
  const titleId = `activity-notes-title-${messageId}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-body font-weight-strong text-fg">
          {t('activity_notes_title')}{' '}
          <span className="text-body-sm font-weight-body text-muted">
            ·{' '}
            {t('activity_notes_count')
              .replace('{count}', String(notes.length))
              .replace('{limit}', String(limit))}
          </span>
        </h2>
        {notes.length > 0 ? (
          <button
            type="button"
            className="rounded-btn px-2 py-0.5 text-caption text-error hover:bg-surface-control disabled:opacity-50"
            disabled={pending}
            onClick={() => setConfirmDeleteAll(true)}
          >
            {t('activity_notes_delete_all')}
          </button>
        ) : null}
      </header>
      <p className="text-caption text-muted">{t('activity_notes_private_hint')}</p>

      {errorCode ? (
        <p role="alert" className="text-body-sm text-error">
          {t(activityNoteErrorMessageKey(errorCode))}
        </p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.noteId} className="list-none">
              {editingId === note.noteId ? (
                <ActivityNoteComposer
                  viewerUsername={viewerUsername}
                  initialBody={note.body}
                  pending={pending}
                  submitLabel={t('activity_notes_save')}
                  onSubmit={(body) => handleUpdate(note.noteId, body)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ActivityNoteCard
                  note={note}
                  pending={pending}
                  onEdit={() => setEditingId(note.noteId)}
                  onDelete={() => handleDelete(note.noteId)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {atLimit ? (
        <p className="text-body-sm text-muted">{t('activity_notes_limit_reached')}</p>
      ) : (
        <ActivityNoteComposer
          viewerUsername={viewerUsername}
          pending={pending}
          submitLabel={t('activity_notes_add')}
          onSubmit={handleCreate}
        />
      )}

      <DeleteAllActivityNotesModal
        open={confirmDeleteAll}
        pending={pending}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={handleDeleteAll}
      />
    </section>
  );
}
