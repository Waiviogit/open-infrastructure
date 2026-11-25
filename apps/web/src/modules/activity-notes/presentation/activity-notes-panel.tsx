'use client';

// Private notes are paused: they are not loaded, saved or edited, only the agent link is shown
// (docs/apps/web/spec/activity-notes.md).
// import { useCallback, useEffect, useState } from 'react';

// import type { ActivityNote } from '../domain/activity-note.types';
import { ActivityNoteImportBanner } from './activity-note-import-banner';
// import { ActivityNotesSection, type ActivityNotesUpdater } from './activity-notes-section';

// export type ActivityNotesPanelProps = {
//   messageId: string;
//   viewerUsername: string | null;
//   /** The viewer's notes from the server; `null` when signed out (no notes section). */
//   initialNotes: ActivityNote[] | null;
//   limit: number;
//   loadFailed?: boolean;
// };

/** Note from an agent link (`#note=…`) under one activity message: preview and Copy, nothing stored. */
export function ActivityNotesPanel() {
  // const [notes, setNotes] = useState<ActivityNote[]>(initialNotes ?? []);
  //
  // // `router.refresh()` (e.g. after login) passes new server notes; local state must follow.
  // useEffect(() => {
  //   setNotes(initialNotes ?? []);
  // }, [initialNotes]);
  //
  // const updateNotes = useCallback((update: ActivityNotesUpdater) => setNotes(update), []);
  // const appendNote = useCallback(
  //   (note: ActivityNote) =>
  //     setNotes((previous) =>
  //       previous.some((item) => item.noteId === note.noteId) ? previous : [...previous, note],
  //     ),
  //   [],
  // );

  return (
    <div className="flex flex-col gap-4">
      <ActivityNoteImportBanner />
      {/* Private notes are paused.
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
      */}
    </div>
  );
}
