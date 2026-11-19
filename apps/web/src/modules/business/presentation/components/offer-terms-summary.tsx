'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { parseOfferCommercialSummary } from '../../domain/offer-commercial-summary';
import { parseOfferTerms } from '../../domain/offer-terms';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../ui/classes';
import { useOfferPriceLabel } from './offer-card';

export type OfferTermsSummaryProps = {
  terms: unknown;
  disputeRule: 'client' | 'provider' | 'arbiter';
  arbiter: string | null;
  serviceRef: string | null;
  legalRef: string | null;
};

function TermRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-fg-secondary">{label}</dt>
      <dd className={`mt-0.5 text-body-sm text-fg ${BUSINESS_BREAK_TEXT}`}>
        {children}
      </dd>
    </div>
  );
}

function objectHref(objectId: string): string {
  return `/object/${encodeURIComponent(objectId.trim())}`;
}

/**
 * The terms a counterparty agrees to when signing: price, billing, termination, dispute rule,
 * linked service and legal document. Shown before the sign action, never only after it.
 */
export function OfferTermsSummary({
  terms,
  disputeRule,
  arbiter,
  serviceRef,
  legalRef,
}: OfferTermsSummaryProps) {
  const { t } = useI18n();
  const priceLabel = useOfferPriceLabel();
  const commercial = parseOfferCommercialSummary(terms);
  const { termination } = parseOfferTerms(terms);

  const disputeRuleLabel =
    disputeRule === 'arbiter'
      ? t('business_dispute_arbiter')
      : disputeRule === 'provider'
        ? t('business_dispute_provider')
        : t('business_dispute_client');

  return (
    <section
      className={businessCardClass()}
      aria-labelledby="offer-terms-title"
    >
      <h2
        id="offer-terms-title"
        className="text-body font-weight-strong text-heading"
      >
        {t('business_offer_terms_title')}
      </h2>
      <dl className="mt-3 grid gap-x-card-padding gap-y-3 sm:grid-cols-2">
        <TermRow label={t('business_field_price')}>
          <span className="font-weight-strong tabular-nums text-heading">
            {priceLabel(commercial)}
          </span>
          <span className="text-fg-secondary">
            {' '}
            · {t(`business_pricing_${commercial.pricingModel}`)}
          </span>
        </TermRow>
        <TermRow label={t('business_field_billing_cycle')}>
          {commercial.billingCycle ?? t('business_not_specified')}
        </TermRow>
        <TermRow label={t('business_field_termination_who')}>
          {termination?.who
            ? t(`business_termination_who_${termination.who}`)
            : t('business_not_specified')}
        </TermRow>
        <TermRow label={t('business_field_termination_mode')}>
          {termination?.mode
            ? t(`business_termination_mode_${termination.mode}`)
            : t('business_not_specified')}
          {termination?.mode === 'notice' &&
          termination.noticeDays !== undefined
            ? ` · ${t('business_notice_days').replace('{days}', String(termination.noticeDays))}`
            : null}
        </TermRow>
        <TermRow label={t('business_field_dispute_rule')}>
          {disputeRuleLabel}
          {disputeRule === 'arbiter' && arbiter ? (
            <>
              {' · '}
              <Link
                href={`/@${encodeURIComponent(arbiter)}`}
                className="text-link hover:underline"
              >
                @{arbiter}
              </Link>
            </>
          ) : null}
        </TermRow>
        {serviceRef ? (
          <TermRow label={t('business_field_service_ref')}>
            <Link
              href={objectHref(serviceRef)}
              className="text-link hover:underline"
            >
              {t('business_view_service')}
            </Link>
          </TermRow>
        ) : null}
        {legalRef ? (
          <TermRow label={t('business_field_legal_ref')}>
            <Link
              href={objectHref(legalRef)}
              className="text-link hover:underline"
            >
              {t('business_view_legal_document')}
            </Link>
          </TermRow>
        ) : null}
        {termination?.notes?.trim() ? (
          <div className="sm:col-span-2">
            <TermRow label={t('business_field_termination_notes')}>
              <span className="whitespace-pre-wrap">
                {termination.notes.trim()}
              </span>
            </TermRow>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
