import type { Metadata } from 'next';

import { markdownToPlainText } from '@opden-data-layer/common';

import { offerCanonical } from '../domain/canonical';
import type { OfferSeoInput } from '../domain/metadata.types';
import { seoPublicOrigin } from '../infrastructure/seo-public-origin';

/** Search snippets cut around 155–160 characters. */
const DESCRIPTION_MAX_LENGTH = 160;
const ELLIPSIS = '…';

function excerpt(text: string): string {
  if (text.length <= DESCRIPTION_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, DESCRIPTION_MAX_LENGTH - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}

/** Public offer / request version page: name as title, plain description excerpt, canonical URL. */
export function buildOfferMetadata(input: OfferSeoInput): Metadata {
  const origin = seoPublicOrigin();
  const canonical = origin
    ? offerCanonical(origin, input.kind, input.offerId, input.version)
    : undefined;
  const title = input.name.trim() || input.kindLabel;
  const plain = input.description
    ? markdownToPlainText(input.description).trim()
    : '';
  const description = plain
    ? excerpt(plain)
    : `${input.kindLabel} · @${input.authorName}`;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
