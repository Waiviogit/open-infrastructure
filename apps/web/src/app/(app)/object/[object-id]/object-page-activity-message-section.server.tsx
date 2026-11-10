import { notFound } from 'next/navigation';

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
    />
  );
}
