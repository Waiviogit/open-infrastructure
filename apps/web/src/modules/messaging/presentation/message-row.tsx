'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ExternalLinkIcon, MoreHorizontalIcon, ReplyIcon } from '@/icons';
import { HydrationSafeAnchor } from '@/shared/presentation/components/hydration-safe-anchor';
import { OptimisticNavLink } from '@/shared/presentation/navigation/optimistic-nav-link';
import { useMediaQuery } from '@/shared/presentation/layout/hooks/use-breakpoint';

import {
  formatActivityMessageCaption,
  formatMessageTimeCaption,
  isOutgoingMessage,
  messageCopyText,
  resolveMessageQuotePreview,
} from '../domain/messaging.helpers';
import { buildObjectActivityFeedPath } from '../domain/activity-message-permalink';
import { resolveMessageActions } from '../domain/resolve-message-actions';
import type { MessageItem } from '../domain/messaging.types';
import { copyPermalinkToClipboard, isPlainPrimaryClick } from './copy-permalink';
import { DeleteMessageModal } from './delete-message-modal';
import { MessageActionsMenu } from './message-actions-menu';
import { MessageActionsSheet } from './message-actions-sheet';
import { MessageQuoteBlock } from './message-quote-block';

const LONG_PRESS_MS = 500;

export type MessageRowProps = {
  message: MessageItem;
  viewerUsername: string | null;
  messagesById: ReadonlyMap<string, MessageItem>;
  bodyNode: ReactNode;
  authorNode?: ReactNode;
  /** Activity feed: show original-date caption when stamped. */
  activityCaption?: boolean;
  onReply?: (message: MessageItem) => void;
  onEdit?: (message: MessageItem) => void;
  onDelete?: (message: MessageItem) => void | Promise<void>;
  /** Activity permalink (`/object/:id/social/activity/:messageId`): open icon + "Copy link". */
  permalinkHref?: string | null;
  /** `false` hides the open icon but keeps "Copy link" (the permalink page itself). */
  showPermalinkIcon?: boolean;
  /** Plain click on the open icon (preview modal). Without it the icon navigates to the full page. */
  onOpenPermalink?: (message: MessageItem) => void;
};

export function MessageRow({
  message,
  viewerUsername,
  messagesById,
  bodyNode,
  authorNode,
  activityCaption = false,
  onReply,
  onEdit,
  onDelete,
  permalinkHref = null,
  showPermalinkIcon = true,
  onOpenPermalink,
}: MessageRowProps) {
  const { t, locale } = useI18n();
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const finePointer = useMediaQuery('(pointer: fine)');
  const canHover = useMediaQuery('(hover: hover)');
  const showDesktopChrome = canHover && finePointer && !coarsePointer;
  const outgoing = isOutgoingMessage(message, viewerUsername);
  const actions = resolveMessageActions(message, viewerUsername);
  const hasAnyAction =
    actions.edit || actions.delete || actions.copy || actions.reply || permalinkHref != null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressMovedRef = useRef(false);

  const quote = resolveMessageQuotePreview(message, messagesById);
  const editedLabel = t('messaging_edited');

  const timeCaption = activityCaption
    ? formatActivityMessageCaption(
        message,
        locale,
        t('object_activity_original_date_caption'),
        editedLabel,
      )
    : formatMessageTimeCaption(
        message.created_at_unix,
        locale,
        message.updated_at_unix,
        editedLabel,
      );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onDoc = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const handleCopy = useCallback(async () => {
    const text = messageCopyText(message);
    if (text == null) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setMenuOpen(false);
    setSheetOpen(false);
  }, [message]);

  const handleCopyLink = useCallback(async () => {
    setMenuOpen(false);
    setSheetOpen(false);
    if (permalinkHref) {
      await copyPermalinkToClipboard(permalinkHref);
    }
  }, [permalinkHref]);

  const handlePermalinkClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!onOpenPermalink || !isPlainPrimaryClick(event)) {
        return;
      }
      event.preventDefault();
      onOpenPermalink(message);
    },
    [message, onOpenPermalink],
  );

  const handleReply = useCallback(() => {
    setMenuOpen(false);
    setSheetOpen(false);
    onReply?.(message);
  }, [message, onReply]);

  const handleEdit = useCallback(() => {
    setMenuOpen(false);
    setSheetOpen(false);
    onEdit?.(message);
  }, [message, onEdit]);

  const handleDeleteRequest = useCallback(() => {
    setMenuOpen(false);
    setSheetOpen(false);
    setDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!onDelete) {
      return;
    }
    setDeletePending(true);
    try {
      await onDelete(message);
      setDeleteOpen(false);
    } finally {
      setDeletePending(false);
    }
  }, [message, onDelete]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!coarsePointer || !hasAnyAction) {
        return;
      }
      if (event.pointerType !== 'touch') {
        return;
      }
      longPressMovedRef.current = false;
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        setSheetOpen(true);
      }, LONG_PRESS_MS);
    },
    [clearLongPress, coarsePointer, hasAnyAction],
  );

  const onPointerMove = useCallback(() => {
    if (coarsePointer) {
      longPressMovedRef.current = true;
      clearLongPress();
    }
  }, [clearLongPress, coarsePointer]);

  const onPointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const bubbleClass = [
    'max-w-[min(100%,28rem)] rounded-card px-3 py-2',
    outgoing ? 'bg-accent-soft text-fg' : 'border border-border bg-surface text-fg',
  ].join(' ');

  const actionHandlers = {
    onReply: onReply ? handleReply : undefined,
    onCopy: actions.copy ? handleCopy : undefined,
    onEdit: onEdit ? handleEdit : undefined,
    onDelete: onDelete ? handleDeleteRequest : undefined,
    onCopyLink: permalinkHref ? handleCopyLink : undefined,
  };

  const permalinkAnchor = permalinkHref && showPermalinkIcon ? (
    <HydrationSafeAnchor
      href={permalinkHref}
      className="rounded-btn p-1 text-fg-secondary hover:bg-surface-muted hover:text-fg"
      aria-label={t('object_activity_open_message_aria')}
      title={t('object_activity_open_message_aria')}
      onClick={handlePermalinkClick}
    >
      <ExternalLinkIcon size={18} />
    </HydrationSafeAnchor>
  ) : null;

  const desktopActions =
    showDesktopChrome && hasAnyAction ? (
      <div
        ref={menuRef}
        className="flex shrink-0 items-start gap-0.5 pt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100"
      >
        {permalinkAnchor}
        {actions.reply && onReply ? (
          <button
            type="button"
            className="rounded-btn p-1 text-fg-secondary hover:bg-surface-muted hover:text-fg"
            aria-label={t('messaging_action_reply')}
            onClick={handleReply}
          >
            <ReplyIcon size={18} />
          </button>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className="rounded-btn p-1 text-fg-secondary hover:bg-surface-muted hover:text-fg"
            aria-label={t('messaging_action_more_aria')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontalIcon size={18} />
          </button>
          {menuOpen ? (
            <div
              className={[
                'absolute bottom-full z-[80] mb-1',
                outgoing ? 'end-0' : 'start-0',
              ].join(' ')}
            >
              <MessageActionsMenu actions={actions} {...actionHandlers} />
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  /** Touch has no hover chrome — keep the open icon visible so the permalink is discoverable. */
  const touchPermalink =
    !showDesktopChrome && permalinkAnchor ? (
      <div className="flex shrink-0 items-start pt-1">{permalinkAnchor}</div>
    ) : null;
  const sideActions = desktopActions ?? touchPermalink;

  return (
    <>
      <div
        className={[
          'group/message flex items-start gap-1.5',
          outgoing ? 'justify-end' : 'justify-start',
        ].join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {outgoing ? sideActions : null}

        <div className={bubbleClass}>
          {authorNode}
          {message.source_object ? (
            <p className="mb-1 text-caption">
              <OptimisticNavLink
                href={buildObjectActivityFeedPath(message.source_object.object_id)}
                className="text-link hover:underline"
              >
                {t('object_activity_source_from').replace(
                  '{name}',
                  message.source_object.name,
                )}
              </OptimisticNavLink>
            </p>
          ) : null}
          {quote ? <MessageQuoteBlock quote={quote} /> : null}
          {bodyNode}
          <p className="mt-1 text-caption text-muted">{timeCaption}</p>
          {activityCaption && (message.duplicate_count ?? 1) > 1 ? (
            <p className="mt-0.5 text-caption text-muted">
              {t('object_activity_duplicate_badge').replace(
                '{count}',
                String((message.duplicate_count ?? 1) - 1),
              )}
            </p>
          ) : null}
        </div>

        {!outgoing ? sideActions : null}
      </div>

      <MessageActionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={actions}
        {...actionHandlers}
      />

      <DeleteMessageModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        pending={deletePending}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
