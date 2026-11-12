'use client';

import { useMemo, useRef } from 'react';

import { useBindSocialEmbedHeights } from '../hooks/use-bind-social-embed-heights';
import { useCodeBlockCopyButtons } from '../hooks/use-code-block-copy-buttons';

export type SocialEmbedHtmlProps = {
  html: string;
  className?: string;
};

/**
 * Sanitized post HTML whose IG / FB / X / LinkedIn iframes resize to content height.
 * Every code block (`<pre>`) gets a Copy button.
 */
export function SocialEmbedHtml({ html, className }: SocialEmbedHtmlProps) {
  const ref = useRef<HTMLDivElement>(null);
  useBindSocialEmbedHeights(ref);
  const copyButtons = useCodeBlockCopyButtons(ref, html);
  // React 19 diffs `dangerouslySetInnerHTML` by object identity: a fresh object on every render
  // would reset `innerHTML` (reloading embeds and dropping the code-block wrappers).
  const innerHtml = useMemo(() => ({ __html: html }), [html]);
  return (
    <>
      <div
        ref={ref}
        suppressHydrationWarning
        className={className}
        dangerouslySetInnerHTML={innerHtml}
      />
      {copyButtons}
    </>
  );
}
