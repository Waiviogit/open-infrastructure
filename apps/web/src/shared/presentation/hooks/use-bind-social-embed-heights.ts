'use client';

import { useLayoutEffect, type RefObject } from 'react';

import {
  applySocialEmbedFrameHeight,
  isSocialEmbedResizeOrigin,
  parseSocialEmbedHeight,
} from '@/shared/infrastructure/social-embed-height';

import { useFitLinkedInEmbeds } from './use-fit-linkedin-embeds';

/**
 * Grow IG / FB / X iframes to the height they post, so the card does not scroll inside.
 * LinkedIn posts no height; its iframes are sized from the card layout instead.
 */
export function useBindSocialEmbedHeights(
  containerRef: RefObject<HTMLElement | null>,
): void {
  useFitLinkedInEmbeds(containerRef);
  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isSocialEmbedResizeOrigin(event.origin)) {
        return;
      }
      const height = parseSocialEmbedHeight(event.data);
      if (height == null) {
        return;
      }
      const root = containerRef.current;
      if (!root) {
        return;
      }
      const iframes = root.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (event.source === iframe.contentWindow) {
          applySocialEmbedFrameHeight(iframe, height);
          break;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [containerRef]);
}
