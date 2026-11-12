'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { CodeBlockCopyButton } from '../components/code-block-copy-button';

/** Wrapper added around each rendered `<pre>`; styled in `app/global.css`. */
export const CODE_BLOCK_WRAPPER_CLASS = 'code-block';
/** Host for the portaled copy button inside the wrapper. */
export const CODE_BLOCK_COPY_HOST_CLASS = 'code-block-copy';

type CopyTarget = { pre: HTMLElement; host: HTMLElement };

function attachCopyTargets(root: HTMLElement): CopyTarget[] {
  const targets: CopyTarget[] = [];
  for (const pre of root.querySelectorAll('pre')) {
    const parent = pre.parentElement;
    if (!parent || parent.classList.contains(CODE_BLOCK_WRAPPER_CLASS)) {
      continue;
    }
    const wrapper = document.createElement('div');
    wrapper.className = CODE_BLOCK_WRAPPER_CLASS;
    const host = document.createElement('span');
    host.className = CODE_BLOCK_COPY_HOST_CLASS;
    parent.insertBefore(wrapper, pre);
    wrapper.append(pre, host);
    targets.push({ pre, host });
  }
  return targets;
}

/** Puts each `<pre>` back where it was, so a re-run (or Strict Mode) never double-wraps. */
function detachCopyTargets(targets: readonly CopyTarget[]): void {
  for (const { pre, host } of targets) {
    const wrapper = host.parentElement;
    host.remove();
    if (wrapper?.parentElement && wrapper.classList.contains(CODE_BLOCK_WRAPPER_CLASS)) {
      wrapper.parentElement.insertBefore(pre, wrapper);
      wrapper.remove();
    }
  }
}

/**
 * Adds a Copy button to every `<pre>` inside `containerRef` (HTML set via `dangerouslySetInnerHTML`).
 * Re-runs when `html` changes. Render the returned portals next to the container, and memoize the
 * `{ __html }` object on `html`: React 19 resets `innerHTML` whenever that object changes identity.
 */
export function useCodeBlockCopyButtons(
  containerRef: RefObject<HTMLElement | null>,
  html: string,
): ReactNode {
  const [targets, setTargets] = useState<CopyTarget[]>([]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }
    const attached = attachCopyTargets(root);
    setTargets(attached);
    return () => {
      detachCopyTargets(attached);
      setTargets([]);
    };
  }, [containerRef, html]);

  if (targets.length === 0) {
    return null;
  }
  return targets.map(({ pre, host }, index) =>
    createPortal(<CodeBlockCopyButton pre={pre} />, host, `code-block-copy-${index}`),
  );
}
