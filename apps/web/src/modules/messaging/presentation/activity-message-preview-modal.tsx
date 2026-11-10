'use client';

import Link from 'next/link';
import { useCallback, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CloseIcon, ExternalLinkIcon, LinkIcon } from '@/icons';
import { ModalShell, ModalShellCloseButton } from '@/shared/presentation';
import { OptimisticNavLink } from '@/shared/presentation/navigation';

import { buildObjectActivityFeedPath } from '../domain/activity-message-permalink';
import {
  formatActivityMessageCaption,
  type MessageQuotePreview,
} from '../domain/messaging.helpers';
import type { MessageItem } from '../domain/messaging.types';
import { ActivityMessageAuthor, ActivityMessageBody } from './activity-message-body';
import { copyPermalinkToClipboard } from './copy-permalink';
import { MessageQuoteBlock } from './message-quote-block';

const PILL_CLASS =
  'flex size-9 items-center justify-center rounded-circle border border-border bg-surface text-fg-secondary shadow-card hover:bg-surface-control hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const ICON_BUTTON_CLASS =
  'flex size-9 items-center justify-center rounded-btn text-fg-secondary hover:bg-surface-muted hover:text-fg';

export type ActivityMessagePreviewModalProps = {
  message: MessageItem;
  /** Quoted parent when the message is a reply (same resolution as the feed row). */
  quote: MessageQuotePreview | null;
  /** Message permalink — current URL while the modal is open; "Open full page" reloads it as a page. */
  href: string;
  viewerUsername: string | null;
  onClose: () => void;
};

/** Post-modal-style preview of one activity message, opened from a feed row's open icon. */
export function ActivityMessagePreviewModal({
  message,
  quote,
  href,
  viewerUsername,
  onClose,
}: ActivityMessagePreviewModalProps) {
  const { t, locale } = useI18n();
  const openFullPageLabel = t('object_activity_open_full_page');
  const copyLinkLabel = t('messaging_action_copy_link');

  const onCopyLink = useCallback(() => {
    void copyPermalinkToClipboard(href);
  }, [href]);

  const caption = formatActivityMessageCaption(
    message,
    locale,
    t('object_activity_original_date_caption'),
    t('messaging_edited'),
  );
  const duplicateCount = message.duplicate_count ?? 1;

  const openFullPage = (className: string, children: ReactNode) => (
    <Link
      href={href}
      className={className}
      aria-label={openFullPageLabel}
      title={openFullPageLabel}
      suppressHydrationWarning
    >
      {children}
    </Link>
  );

  const mobileHeader = (
    <div className="flex items-center justify-end gap-1 border-b border-border px-4 py-2 lg:hidden">
      {openFullPage(ICON_BUTTON_CLASS, <ExternalLinkIcon size={18} />)}
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        aria-label={copyLinkLabel}
        onClick={onCopyLink}
      >
        <LinkIcon size={18} />
      </button>
      <ModalShellCloseButton onClose={onClose} />
    </div>
  );

  const desktopAside = (
    <div className="flex flex-col gap-2 pt-4">
      <button type="button" className={PILL_CLASS} aria-label={t('close')} onClick={onClose}>
        <CloseIcon size={16} />
      </button>
      {openFullPage(PILL_CLASS, <ExternalLinkIcon size={16} />)}
      <button
        type="button"
        className={PILL_CLASS}
        aria-label={copyLinkLabel}
        title={copyLinkLabel}
        onClick={onCopyLink}
      >
        <LinkIcon size={16} />
      </button>
    </div>
  );

  return (
    <ModalShell
      open
      onClose={onClose}
      align="start"
      maxWidthClass="max-w-container-post"
      panelClassName="border-0"
      ariaLabel={t('object_activity_open_message_aria')}
      aside={desktopAside}
      header={mobileHeader}
    >
      <article className="px-6 py-5 sm:px-8 sm:py-6">
        <ActivityMessageAuthor author={message.author} />
        {message.source_object ? (
          <p className="mb-2 text-caption">
            <OptimisticNavLink
              href={buildObjectActivityFeedPath(message.source_object.object_id)}
              className="text-link hover:underline"
            >
              {t('object_activity_source_from').replace('{name}', message.source_object.name)}
            </OptimisticNavLink>
          </p>
        ) : null}
        {quote ? <MessageQuoteBlock quote={quote} /> : null}
        <ActivityMessageBody
          message={message}
          viewerUsername={viewerUsername}
          textClassName="text-body"
        />
        <p className="mt-3 text-caption text-muted">{caption}</p>
        {duplicateCount > 1 ? (
          <p className="mt-0.5 text-caption text-muted">
            {t('object_activity_duplicate_badge').replace('{count}', String(duplicateCount - 1))}
          </p>
        ) : null}
      </article>
    </ModalShell>
  );
}
