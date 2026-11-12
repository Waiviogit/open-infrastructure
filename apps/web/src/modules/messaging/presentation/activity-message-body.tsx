'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { sanitizePostBodyHtml } from '@/shared/infrastructure/post-body-html-pipeline';
import { COMPACT_BODY_BLOCK_CLASSES } from '@/modules/feed/presentation/components/post-body-typography';
import { SocialEmbedHtml } from '@/shared/presentation';
import { OptimisticNavLink } from '@/shared/presentation/navigation';

import { resolveMessagePresentation } from '../domain/messaging.helpers';
import type { MessageItem } from '../domain/messaging.types';

const BODY_CLASS = `blog-post-body break-words ${COMPACT_BODY_BLOCK_CLASSES}`;

/** Activity message body: markdown → sanitized HTML with social embeds (Instagram, YouTube, …). */
export function ActivityMessageBody({
  message,
  viewerUsername,
  textClassName = 'text-body-sm',
}: {
  message: MessageItem;
  viewerUsername: string | null;
  textClassName?: string;
}) {
  const { t } = useI18n();
  const presentation = resolveMessagePresentation(message, viewerUsername);

  if (presentation.kind === 'plain' || presentation.kind === 'decrypted') {
    return (
      <SocialEmbedHtml
        html={sanitizePostBodyHtml(presentation.text)}
        className={`${BODY_CLASS} ${textClassName}`}
      />
    );
  }

  return (
    <p className={`${textClassName} text-muted`}>{t('object_activity_encrypted_unsupported')}</p>
  );
}

export function ActivityMessageAuthor({ author }: { author: string }) {
  return (
    <p className="mb-1 text-caption font-weight-label">
      <OptimisticNavLink
        href={`/@${encodeURIComponent(author)}`}
        className="text-accent hover:underline"
      >
        {author}
      </OptimisticNavLink>
    </p>
  );
}
