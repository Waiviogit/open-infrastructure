'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { markdownToPlainText } from '@opden-data-layer/common';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { UserAvatar } from '@/shared/presentation';

import {
  parseOfferCommercialSummary,
  type OfferCommercialSummary,
} from '../../domain/offer-commercial-summary';
import { formatUsd } from '../../domain/usd-format';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../ui/classes';

const AVATAR_SIZE = 40;
const VISIBLE_TAGS = 3;

export function useOfferPriceLabel(): (
  summary: OfferCommercialSummary,
) => string {
  const { t } = useI18n();
  return (summary) => {
    if (summary.amountUsd === null) {
      return t('business_price_on_request');
    }
    const amount = formatUsd(summary.amountUsd);
    return summary.pricingModel === 'hourly'
      ? t('business_price_per_hour').replace('{amount}', amount)
      : amount;
  };
}

export type OfferCardData = {
  name: string;
  author: string;
  version: number;
  description: string | null;
  tags: string[];
  terms: unknown;
};

export type OfferCardProps = {
  offer: OfferCardData;
  href: string;
  /** Catalog cards show who offers it; the author's own lists do not. */
  showAuthor?: boolean;
  /** Status badge for the author's own lists (Active / Retired). */
  badge?: ReactNode;
};

/** Catalog / own-list card: the whole card is the link, price is the second strongest signal. */
export function OfferCard({
  offer,
  href,
  showAuthor = true,
  badge,
}: OfferCardProps) {
  const { t } = useI18n();
  const priceLabel = useOfferPriceLabel();
  const summary = parseOfferCommercialSummary(offer.terms);
  const excerpt = offer.description
    ? markdownToPlainText(offer.description).trim()
    : '';
  const visibleTags = offer.tags.slice(0, VISIBLE_TAGS);
  const hiddenTagCount = offer.tags.length - visibleTags.length;
  const title = offer.name.trim() || t('business_draft_untitled');

  return (
    <Link
      href={href}
      className={businessCardClass({ interactive: true })}
      suppressHydrationWarning
    >
      <article className="flex items-start gap-3">
        {showAuthor ? (
          <UserAvatar username={offer.author} size={AVATAR_SIZE} />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h2
              className={`line-clamp-2 text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
            >
              {title}
            </h2>
            <p
              className={[
                'text-body-sm tabular-nums sm:shrink-0 sm:text-end',
                summary.amountUsd === null
                  ? 'text-fg-secondary'
                  : 'font-weight-strong text-heading',
              ].join(' ')}
            >
              {priceLabel(summary)}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-fg-secondary">
            {showAuthor ? (
              <span className={BUSINESS_BREAK_TEXT}>@{offer.author}</span>
            ) : null}
            <span>
              {t('business_version_short').replace(
                '{version}',
                String(offer.version),
              )}
            </span>
            {summary.billingCycle ? (
              <span className={BUSINESS_BREAK_TEXT}>
                {summary.billingCycle}
              </span>
            ) : null}
            {badge}
          </div>
          {excerpt ? (
            <p
              className={`mt-2 line-clamp-2 text-body-sm text-fg ${BUSINESS_BREAK_TEXT}`}
            >
              {excerpt}
            </p>
          ) : null}
          {visibleTags.length > 0 ? (
            <ul
              className="mt-2 flex flex-wrap gap-1.5"
              aria-label={t('business_field_tags')}
            >
              {visibleTags.map((tag) => (
                <li
                  key={tag}
                  className="max-w-full truncate rounded-pill bg-surface-control px-2 py-0.5 text-caption text-fg"
                >
                  {tag}
                </li>
              ))}
              {hiddenTagCount > 0 ? (
                <li className="rounded-pill px-1 py-0.5 text-caption text-fg-secondary">
                  +{hiddenTagCount}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
