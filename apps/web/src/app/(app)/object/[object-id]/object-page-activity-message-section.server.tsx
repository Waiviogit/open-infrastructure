import { notFound } from 'next/navigation';

// Private notes are paused: not loaded (docs/apps/web/spec/activity-notes.md).
// import { ACTIVITY_NOTES_MAX_PER_MESSAGE } from '@/modules/activity-notes';
// import { fetchActivityNotesServer } from '@/modules/activity-notes/infrastructure/activity-notes.server';
import { getObjectActivityMessageQuery } from '@/modules/messaging';

import { ObjectPageActivityMessageClient } from './object-page-activity-message-client';

export type ObjectPageActivityMessageSectionProps = {
  objectId: string;
  messageId: string;
  viewerUsername: string | null;
};

/** Permalink page body for `/object/:id/social/activity/:messageId`. */
export async function ObjectPageActivityMessageSection({
  objectId,
  messageId,
  viewerUsername,
}: ObjectPageActivityMessageSectionProps) {
  // Private notes are paused: they no longer load next to the message.
  // const [message, notes] = await Promise.all([
  //   getObjectActivityMessageQuery(objectId, messageId, viewerUsername),
  //   viewerUsername ? fetchActivityNotesServer(messageId) : Promise.resolve(null),
  // ]);
  const message = await getObjectActivityMessageQuery(objectId, messageId, viewerUsername);
  if (!message) {
    notFound();
  }

  // A reply shows its parent as a quote; without it only the `quote_json` snapshot (or "deleted") is left.
  const parent = message.reply_to
    ? await getObjectActivityMessageQuery(objectId, message.reply_to, viewerUsername)
    : null;

  return (
    <ObjectPageActivityMessageClient
      objectId={objectId}
      message={message}
      parent={parent}
      viewerUsername={viewerUsername}
      // initialNotes={notes ? (notes.ok ? notes.value.items : []) : null}
      // notesLimit={notes?.ok ? notes.value.limit : ACTIVITY_NOTES_MAX_PER_MESSAGE}
      // notesLoadFailed={notes ? !notes.ok : false}
    />
  );
}
