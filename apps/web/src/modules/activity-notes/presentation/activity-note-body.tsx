'use client';

import { sanitizePostBodyHtml } from '@/shared/infrastructure/post-body-html-pipeline';
import { COMPACT_BODY_BLOCK_CLASSES } from '@/modules/feed/presentation/components/post-body-typography';
import { SocialEmbedHtml } from '@/shared/presentation';

/** Same pipeline as activity messages; long variant lines wrap instead of scrolling sideways. */
const NOTE_BODY_CLASS = `blog-post-body break-words text-body-sm text-fg ${COMPACT_BODY_BLOCK_CLASSES} [&_pre]:whitespace-pre-wrap [&_pre]:break-words`;

/** Note markdown rendered as sanitized HTML; code blocks get a Copy button. */
export function ActivityNoteBody({ markdown }: { markdown: string }) {
  return (
    <SocialEmbedHtml
      html={sanitizePostBodyHtml(markdown)}
      className={NOTE_BODY_CLASS}
    />
  );
}
