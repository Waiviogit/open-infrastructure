'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  HTML_SANDBOX_MAX_HEIGHT_PX,
  HTML_SANDBOX_MIN_HEIGHT_PX,
  HTML_SANDBOX_PERMISSIONS,
  HTML_SANDBOX_REVEAL_TIMEOUT_MS,
} from '../../domain/html-object.constants';
import {
  buildHtmlSandboxDocument,
  buildHtmlSandboxViewportMessage,
  parseHtmlSandboxResizeMessage,
} from '../../domain/html-sandbox-document';

export type HtmlSandboxFrameProps = {
  /** The author's HTML page (already normalized). */
  source: string;
  title: string;
};

function clampFrameHeight(height: number): number {
  return Math.min(HTML_SANDBOX_MAX_HEIGHT_PX, Math.max(HTML_SANDBOX_MIN_HEIGHT_PX, height));
}

/**
 * Renders an `html` object page in an isolated iframe sized to its content (no inner scroll).
 *
 * On-chain HTML is untrusted: the frame has no `allow-same-origin`, so its scripts run in an
 * opaque origin and only talk to the app through the bootstrap's messages, which are accepted
 * from this frame's window only.
 *
 * Client-only: the document is built with the window height (`vh` in the page), which the server
 * does not know. The frame stays invisible behind a placeholder until the page has loaded (or
 * {@link HTML_SANDBOX_REVEAL_TIMEOUT_MS} passes), so it appears once at its height instead of
 * growing in steps while fonts and images load.
 */
export function HtmlSandboxFrame({ source, title }: HtmlSandboxFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [height, setHeight] = useState(HTML_SANDBOX_MIN_HEIGHT_PX);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setViewportHeight(window.innerHeight);
  }, []);

  const srcDoc = useMemo(
    () => (viewportHeight == null ? null : buildHtmlSandboxDocument(source, { viewportHeight })),
    [source, viewportHeight],
  );

  const sendViewport = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      buildHtmlSandboxViewportMessage(window.innerHeight),
      '*',
    );
  }, []);

  useEffect(() => {
    if (srcDoc == null) {
      return;
    }
    setHeight(HTML_SANDBOX_MIN_HEIGHT_PX);
    setRevealed(false);
    const revealTimer = window.setTimeout(() => setRevealed(true), HTML_SANDBOX_REVEAL_TIMEOUT_MS);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) {
        return;
      }
      const message = parseHtmlSandboxResizeMessage(event.data);
      if (!message) {
        return;
      }
      setHeight(clampFrameHeight(message.height));
      if (message.complete) {
        setRevealed(true);
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', sendViewport);
    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', sendViewport);
    };
  }, [sendViewport, srcDoc]);

  if (srcDoc == null) {
    return (
      <div
        className="w-full animate-pulse bg-surface-muted"
        style={{ height: HTML_SANDBOX_MIN_HEIGHT_PX }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={revealed ? 'relative' : 'relative animate-pulse bg-surface-muted'}
      aria-busy={revealed ? undefined : true}
    >
      <iframe
        ref={frameRef}
        srcDoc={srcDoc}
        title={title}
        sandbox={HTML_SANDBOX_PERMISSIONS}
        className={['block w-full border-0', revealed ? 'opacity-100' : 'opacity-0'].join(' ')}
        style={{ height: revealed ? height : HTML_SANDBOX_MIN_HEIGHT_PX }}
      />
    </div>
  );
}
