'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ActivityNote } from '../domain/activity-note.types';
import { ActivityNoteImportBanner } from './activity-note-import-banner';
import { ActivityNotesSection, type ActivityNotesUpdater } from './activity-notes-section';

export type ActivityNotesPanelProps = {
  messageId: string;
  viewerUsername: string | null;
  /** The viewer's notes from the server; `null` when signed out (no notes section). */
  initialNotes: ActivityNote[] | null;
  limit: number;
  loadFailed?: boolean;
};

/** Import banner (everyone) + private notes section (signed in) under one activity message. */
export function ActivityNotesPanel({
  messageId,
  viewerUsername,
  initialNotes,
  limit,
  loadFailed = false,
}: ActivityNotesPanelProps) {
  const [notes, setNotes] = useState<ActivityNote[]>(initialNotes ?? []);

  // `router.refresh()` (e.g. after login) passes new server notes; local state must follow.
  useEffect(() => {
    setNotes(initialNotes ?? []);
  }, [initialNotes]);

  const updateNotes = useCallback((update: ActivityNotesUpdater) => setNotes(update), []);
  const appendNote = useCallback(
    (note: ActivityNote) =>
      setNotes((previous) =>
        previous.some((item) => item.noteId === note.noteId) ? previous : [...previous, note],
      ),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <ActivityNoteImportBanner
        messageId={messageId}
        viewerUsername={viewerUsername}
        onSaved={appendNote}
      />
      {initialNotes && viewerUsername ? (
        <ActivityNotesSection
          messageId={messageId}
          viewerUsername={viewerUsername}
          notes={notes}
          limit={limit}
          loadFailed={loadFailed}
          onNotesChange={updateNotes}
        />
      ) : null}
    </div>
  );
}
