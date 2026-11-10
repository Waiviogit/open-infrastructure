'use client';

import { useMemo } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { resolveActivityMessageHref } from '../domain/activity-message-permalink';
import {
  compareActivityMessagesDesc,
  groupMessagesByDay,
  isOutgoingMessage,
  messageActivitySortUnix,
  resolveMessageQuotePreview,
} from '../domain/messaging.helpers';
import type { MessageItem } from '../domain/messaging.types';
import { ActivityMessageAuthor, ActivityMessageBody } from './activity-message-body';
import { ActivityMessagePreviewModal } from './activity-message-preview-modal';
import { MessageRow } from './message-row';
import { useActivityMessagePreview } from './use-activity-message-preview';

export type ObjectActivityFeedListProps = {
  messages: MessageItem[];
  /** Not rendered as rows — only resolve reply quotes (e.g. the parent on the permalink page). */
  relatedMessages?: MessageItem[];
  viewerUsername: string | null;
  /**
   * Object whose feed renders the list — permalinks use it. Omit on multi-object feeds (home):
   * each row then links under its own object (`source_object`).
   */
  contextObjectId?: string | null;
  /** Open icon → preview modal (default). `false` on the permalink page itself (Copy link stays). */
  showOpenPermalink?: boolean;
  loadingMore?: boolean;
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
  onReply?: (message: MessageItem) => void;
  onEdit?: (message: MessageItem) => void;
  onDelete?: (message: MessageItem) => void | Promise<void>;
};

export function ObjectActivityFeedList({
  messages,
  relatedMessages,
  viewerUsername,
  contextObjectId = null,
  showOpenPermalink = true,
  loadingMore = false,
  sentinelRef,
  onReply,
  onEdit,
  onDelete,
}: ObjectActivityFeedListProps) {
  const { t, locale } = useI18n();
  const preview = useActivityMessagePreview();

  const messagesById = useMemo(
    () =>
      new Map(
        [...(relatedMessages ?? []), ...messages].map((message) => [message.message_id, message]),
      ),
    [messages, relatedMessages],
  );

  const sortedMessages = useMemo(
    () => [...messages].sort(compareActivityMessagesDesc),
    [messages],
  );

  const groups = useMemo(
    () =>
      groupMessagesByDay(
        sortedMessages,
        (unix) =>
          new Date(unix * 1000).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        messageActivitySortUnix,
      ),
    [sortedMessages, locale],
  );

  const previewState = preview.preview;
  /** Latest row data (edits) for the open preview; the snapshot covers a row that left the list. */
  const previewMessage = previewState
    ? (messagesById.get(previewState.message.message_id) ?? previewState.message)
    : null;

  if (messages.length === 0) {
    return (
      <p className="py-6 text-center text-body-sm text-muted">
        {t('object_activity_empty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.dayKey}>
          <div className="mb-3 flex justify-center">
            <span className="rounded-full bg-surface-control px-3 py-1 text-caption text-muted">
              {group.label}
            </span>
          </div>
          <div className="space-y-3">
            {group.messages.map((message) => {
              const outgoing = isOutgoingMessage(message, viewerUsername);
              const permalinkHref = resolveActivityMessageHref(message, contextObjectId);

              return (
                <MessageRow
                  key={message.message_id}
                  message={message}
                  viewerUsername={viewerUsername}
                  messagesById={messagesById}
                  bodyNode={
                    <ActivityMessageBody message={message} viewerUsername={viewerUsername} />
                  }
                  activityCaption
                  authorNode={
                    !outgoing ? <ActivityMessageAuthor author={message.author} /> : undefined
                  }
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  permalinkHref={permalinkHref}
                  showPermalinkIcon={showOpenPermalink}
                  onOpenPermalink={
                    permalinkHref ? (row) => preview.open(row, permalinkHref) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
      {loadingMore ? (
        <p className="py-2 text-center text-caption text-muted">
          {t('messaging_loading_older')}
        </p>
      ) : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {previewState && previewMessage ? (
        <ActivityMessagePreviewModal
          message={previewMessage}
          quote={resolveMessageQuotePreview(previewMessage, messagesById)}
          href={previewState.href}
          viewerUsername={viewerUsername}
          onClose={preview.close}
        />
      ) : null}
    </div>
  );
}
