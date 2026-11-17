'use client';

import { useMemo, useRef } from 'react';

import { linkedInIframesToCardSlots } from '@/shared/infrastructure/linkedin-post-card';

import { useBindSocialEmbedHeights } from '../hooks/use-bind-social-embed-heights';
import { useCodeBlockCopyButtons } from '../hooks/use-code-block-copy-buttons';
import { useLinkedInPostSlots } from '../hooks/use-linkedin-post-slots';

export type SocialEmbedHtmlProps = {
  html: string;
  className?: string;
};

/**
 * Sanitized post HTML whose IG / FB / X iframes resize to content height and whose LinkedIn
 * iframes are replaced by native cards. Every code block (`<pre>`) gets a Copy button.
 */
export function SocialEmbedHtml({ html, className }: SocialEmbedHtmlProps) {
  const ref = useRef<HTMLDivElement>(null);
  const bodyHtml = useMemo(() => linkedInIframesToCardSlots(html), [html]);
  useBindSocialEmbedHeights(ref);
  const copyButtons = useCodeBlockCopyButtons(ref, bodyHtml);
  const linkedInCards = useLinkedInPostSlots(ref, bodyHtml);
  // React 19 diffs `dangerouslySetInnerHTML` by object identity: a fresh object on every render
  // would reset `innerHTML` (reloading embeds and dropping the code-block wrappers).
  const innerHtml = useMemo(() => ({ __html: bodyHtml }), [bodyHtml]);
  return (
    <>
      <div
        ref={ref}
        suppressHydrationWarning
        className={className}
        dangerouslySetInnerHTML={innerHtml}
      />
      {copyButtons}
      {linkedInCards}
    </>
  );
}
