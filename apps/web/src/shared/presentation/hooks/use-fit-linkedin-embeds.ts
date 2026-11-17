'use client';

import { useEffect, type RefObject } from 'react';

import {
  estimateLinkedInEmbedHeight,
  fetchLinkedInEmbedLayout,
  LINKEDIN_EMBED_TEXT_FONT,
  linkedInCommentaryWidth,
  linkedInUrnFromEmbedSrc,
  type LinkedInEmbedLayout,
} from '@/shared/infrastructure/linkedin-embed-layout';
import { applySocialEmbedFrameHeight } from '@/shared/infrastructure/social-embed-height';

/** Rendered height of the commentary in LinkedIn's font, wrapped at `width`. */
function measureCommentaryHeight(text: string, width: number): number {
  if (text === '') {
    return 0;
  }
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'all: initial',
    'display: block',
    'position: absolute',
    'top: 0',
    'left: -10000px',
    'visibility: hidden',
    'pointer-events: none',
    `width: ${width}px`,
    `font: ${LINKEDIN_EMBED_TEXT_FONT}`,
    'white-space: pre-wrap',
    'overflow-wrap: break-word',
  ].join(';');
  probe.textContent = text;
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

/**
 * LinkedIn embeds post no height, so their iframes would keep the CSS fallback height.
 * Sizes each LinkedIn iframe under `containerRef` from its card layout (BFF) and the
 * commentary wrapped at the iframe width; re-fits when the width changes.
 */
export function useFitLinkedInEmbeds(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return undefined;
    }
    let disposed = false;
    const tracked = new Set<HTMLIFrameElement>();
    const layouts = new Map<HTMLIFrameElement, LinkedInEmbedLayout>();
    const fittedWidths = new Map<HTMLIFrameElement, number>();

    const fit = (iframe: HTMLIFrameElement) => {
      const layout = layouts.get(iframe);
      const width = iframe.clientWidth;
      if (!layout || width <= 0 || fittedWidths.get(iframe) === width) {
        return;
      }
      fittedWidths.set(iframe, width);
      const commentaryHeight = measureCommentaryHeight(
        layout.commentary,
        linkedInCommentaryWidth(width),
      );
      applySocialEmbedFrameHeight(iframe, estimateLinkedInEmbedHeight(layout, commentaryHeight));
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            for (const entry of entries) {
              fit(entry.target as HTMLIFrameElement);
            }
          });

    const track = (iframe: HTMLIFrameElement) => {
      if (tracked.has(iframe)) {
        return;
      }
      const urn = linkedInUrnFromEmbedSrc(iframe.src);
      if (!urn) {
        return;
      }
      tracked.add(iframe);
      void fetchLinkedInEmbedLayout(urn).then((layout) => {
        if (disposed || !layout || !iframe.isConnected) {
          return;
        }
        layouts.set(iframe, layout);
        fit(iframe);
        resizeObserver?.observe(iframe);
      });
    };

    const scan = () => {
      root.querySelectorAll('iframe').forEach(track);
    };
    scan();
    const mutationObserver = new MutationObserver(scan);
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      disposed = true;
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [containerRef]);
}
