'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import {
  isLinkedInEmbedUrn,
  LINKEDIN_POST_SLOT_CLASS,
  LINKEDIN_POST_SLOT_URN_ATTR,
} from '@/shared/infrastructure/linkedin-post-card';

import { LinkedInPostEmbed } from '../components/linkedin-post-embed';

type LinkedInSlot = { host: HTMLElement; urn: string };

function findSlots(root: HTMLElement): LinkedInSlot[] {
  const hosts = root.querySelectorAll<HTMLElement>(
    `.${LINKEDIN_POST_SLOT_CLASS}[${LINKEDIN_POST_SLOT_URN_ATTR}]`,
  );
  return Array.from(hosts).flatMap((host) => {
    const urn = host.getAttribute(LINKEDIN_POST_SLOT_URN_ATTR) ?? '';
    return isLinkedInEmbedUrn(urn) ? [{ host, urn }] : [];
  });
}

/**
 * Mounts a LinkedIn card into every slot left by `linkedInIframesToCardSlots` inside
 * `containerRef` (HTML set via `dangerouslySetInnerHTML`). Render the returned portals next to
 * the container and memoize the `{ __html }` object on `html`, as for code-block copy buttons.
 */
export function useLinkedInPostSlots(
  containerRef: RefObject<HTMLElement | null>,
  html: string,
): ReactNode {
  const [slots, setSlots] = useState<LinkedInSlot[]>([]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }
    setSlots(findSlots(root));
    return () => setSlots([]);
  }, [containerRef, html]);

  if (slots.length === 0) {
    return null;
  }
  return slots.map(({ host, urn }, index) =>
    createPortal(
      <LinkedInPostEmbed urn={urn} className="my-4" />,
      host,
      `linkedin-post-${index}`,
    ),
  );
}
