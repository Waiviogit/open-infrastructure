'use client';

import { useEffect, useState } from 'react';

import {
  fetchLinkedInPostCard,
  linkedInEmbedPageUrl,
  type LinkedInPostCardResult,
} from '@/shared/infrastructure/linkedin-post-card';

import { LinkedInPostCardView } from './linkedin-post-card';

export type LinkedInPostEmbedProps = {
  /** `urn:li:activity|ugcPost|share:…` of the post. */
  urn: string;
  className?: string;
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * LinkedIn post as a native card (BFF `/api/social-embed/linkedin`). Posts whose layout the
 * card does not know (reshare, document, poll) or that LinkedIn does not serve keep the
 * official iframe at its CSS fallback height.
 */
export function LinkedInPostEmbed({ urn, className }: LinkedInPostEmbedProps) {
  const [result, setResult] = useState<{
    urn: string;
    value: LinkedInPostCardResult;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLinkedInPostCard(urn).then((value) => {
      if (active) {
        setResult({ urn, value });
      }
    });
    return () => {
      active = false;
    };
  }, [urn]);

  const current = result?.urn === urn ? result.value : null;

  if (current === null) {
    return (
      <div
        aria-busy="true"
        className={joinClasses(
          'mx-auto min-h-[8rem] w-full max-w-[540px] animate-pulse rounded-btn border border-border bg-surface-control',
          className,
        )}
      />
    );
  }

  if (current.status === 'unavailable') {
    return (
      <div className={joinClasses('blog-post-linkedin-embed', className)}>
        <iframe
          src={linkedInEmbedPageUrl(urn)}
          title="LinkedIn post"
          scrolling="no"
          loading="lazy"
          allowFullScreen
        />
      </div>
    );
  }

  return <LinkedInPostCardView card={current.card} className={className} />;
}
