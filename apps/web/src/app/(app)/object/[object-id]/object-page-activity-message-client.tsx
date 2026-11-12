'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ActivityNotesPanel, type ActivityNote } from '@/modules/activity-notes';
import { buildObjectActivityFeedPath } from '@/modules/messaging/domain/activity-message-permalink';
import type { MessageItem } from '@/modules/messaging/domain/messaging.types';
import { ObjectActivityFeedList } from '@/modules/messaging/presentation/object-activity-feed-list';

export type ObjectPageActivityMessageClientProps = {
  objectId: string;
  message: MessageItem;
  /** Replied-to message (resolves the quote with full text and image). */
  parent: MessageItem | null;
  viewerUsername: string | null;
  /** The viewer's private notes on this message; `null` when signed out. */
  initialNotes: ActivityNote[] | null;
  notesLimit: number;
  notesLoadFailed: boolean;
};

/** One activity message with a way back to the whole feed. Read-only, like the home feed rows. */
export function ObjectPageActivityMessageClient({
  objectId,
  message,
  parent,
  viewerUsername,
  initialNotes,
  notesLimit,
  notesLoadFailed,
}: ObjectPageActivityMessageClientProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={buildObjectActivityFeedPath(objectId)}
        className="w-fit text-body-sm text-link hover:underline"
        suppressHydrationWarning
      >
        {t('object_activity_back_to_all')}
      </Link>
      <ObjectActivityFeedList
        messages={[message]}
        relatedMessages={parent ? [parent] : undefined}
        viewerUsername={viewerUsername}
        contextObjectId={objectId}
        showOpenPermalink={false}
      />
      <ActivityNotesPanel
        messageId={message.message_id}
        viewerUsername={viewerUsername}
        initialNotes={initialNotes}
        limit={notesLimit}
        loadFailed={notesLoadFailed}
      />
    </div>
  );
}
