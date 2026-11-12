'use client';

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CopyIcon } from '@/icons';

/** How long the button reads "Copied" after a successful copy. */
export const CODE_BLOCK_COPIED_RESET_MS = 2000;

/** Text of a rendered code block. Markdown renderers end `<code>` with one newline; drop it. */
export function codeBlockCopyText(pre: HTMLElement): string {
  return (pre.textContent ?? '').replace(/\r?\n$/, '');
}

export type CodeBlockCopyButtonProps = {
  pre: HTMLElement;
};

/** Copy control pinned to the corner of one rendered `<pre>` block. */
export function CodeBlockCopyButton({ pre }: CodeBlockCopyButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeBlockCopyText(pre));
    } catch {
      return;
    }
    setCopied(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => setCopied(false), CODE_BLOCK_COPIED_RESET_MS);
  };

  const label = copied ? t('copy_button_copied') : t('copy_button');

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-btn border border-border bg-surface px-2 py-1 text-caption text-fg-secondary hover:bg-surface-control hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={label}
      onClick={() => void handleCopy()}
    >
      <CopyIcon size={14} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
