'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';
import { ChevronLeftIcon } from '@/icons';
import { useLoginModal } from '@/modules/auth';
import { UserAvatar } from '@/shared/presentation';

import { buildSignContractOp } from '../../application/build-obl-ops';
import { deterministicContractId } from '../../domain/obl-ids';
import {
  buildMetadataFromSignValues,
  missingRequiredSignParams,
  parseOfferTerms,
} from '../../domain/offer-terms';
import { parseOfferCommercialSummary } from '../../domain/offer-commercial-summary';
import { businessRoutes } from '../../domain/routes';
import type { OblOfferApiRow } from '../../infrastructure/clients/obl-offers.server';
import { BusinessButton } from '../ui/business-button';
import { BusinessField } from '../ui/business-field';
import { BusinessActionError } from '../ui/business-states';
import {
  BUSINESS_BREAK_TEXT,
  BUSINESS_FIELD_CLASS,
  BUSINESS_FOCUS_RING,
  businessButtonClass,
  businessCardClass,
} from '../ui/classes';
import { BusinessDisclosure } from './business-disclosure';
import { ObjectBuilder } from './object-builder';
import { useOfferPriceLabel } from './offer-card';
import { OfferTermsSummary } from './offer-terms-summary';
import { StateBadge } from './state-badge';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';

const AUTHOR_AVATAR_SIZE = 32;

export type PublicOfferPageClientProps = {
  offer: OblOfferApiRow;
  viewer: string | null;
  alreadySigned?: boolean;
};

export function PublicOfferPageClient({
  offer,
  viewer,
  alreadySigned = false,
}: PublicOfferPageClientProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const oblCustomJsonId = useOblCustomJsonId();
  const priceLabel = useOfferPriceLabel();
  const counterparty = offer.author;
  const { broadcast, phase, isBusy, error } = useOblBroadcast(
    viewer ?? '',
    counterparty,
  );
  const [ack, setAck] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [metadataValid, setMetadataValid] = useState(true);
  const [signValues, setSignValues] = useState<Record<string, string>>({});

  const parsedTerms = useMemo(
    () => parseOfferTerms(offer.terms),
    [offer.terms],
  );
  const commercial = useMemo(
    () => parseOfferCommercialSummary(offer.terms),
    [offer.terms],
  );
  const signParams = parsedTerms.signParams;
  const useGuidedForm = signParams.length > 0;

  const isAuthor = viewer === offer.author;
  const isActive = offer.status === 'active';
  const canSign = !alreadySigned && !isAuthor && isActive && viewer !== null;

  const missingRequired = useGuidedForm
    ? missingRequiredSignParams(signParams, signValues)
    : [];

  const canSubmitSign =
    ack && (useGuidedForm ? missingRequired.length === 0 : metadataValid);

  async function onSign() {
    if (!viewer || !ack) {
      return;
    }
    const provider = offer.kind === 'offer' ? offer.author : viewer;
    const client = offer.kind === 'offer' ? viewer : offer.author;

    const metadataPayload = useGuidedForm
      ? buildMetadataFromSignValues(signParams, signValues)
      : Object.keys(metadata).length > 0
        ? metadata
        : undefined;

    const op = buildSignContractOp({
      oblCustomJsonId,
      contractId: deterministicContractId(offer.offer_id, provider, client),
      offerId: offer.offer_id,
      offerVersion: offer.version,
      provider,
      client,
      signer: viewer,
      metadata: metadataPayload,
    });
    await broadcast([op]);
  }

  const catalogHref =
    offer.kind === 'offer'
      ? businessRoutes.discoverOffers
      : businessRoutes.discoverRequests;

  function signPanel() {
    if (alreadySigned && viewer) {
      return (
        <div
          className={businessCardClass({ className: 'flex flex-col gap-3' })}
        >
          <p className="text-body-sm text-fg">
            {t('business_contract_already_signed')}
          </p>
          <Link
            href={businessRoutes.relationship(counterparty)}
            className={businessButtonClass({ variant: 'primary' })}
            suppressHydrationWarning
          >
            {t('business_view_relationship')}
          </Link>
        </div>
      );
    }
    if (isAuthor) {
      return (
        <div
          className={businessCardClass({ className: 'flex flex-col gap-3' })}
        >
          <p className="text-body-sm text-fg">{t('business_offer_is_yours')}</p>
          <Link
            href={businessRoutes.offerDetail(offer.offer_id)}
            className={businessButtonClass({ variant: 'secondary' })}
            suppressHydrationWarning
          >
            {t('business_manage_offer')}
          </Link>
        </div>
      );
    }
    if (!isActive) {
      return (
        <div className={businessCardClass()}>
          <p className="text-body-sm text-fg">
            {t('business_offer_retired_notice')}
          </p>
        </div>
      );
    }
    if (!viewer) {
      return (
        <div
          className={businessCardClass({ className: 'flex flex-col gap-3' })}
        >
          <h2 className="text-body font-weight-strong text-heading">
            {t('business_sign_guest_title')}
          </h2>
          <p className="text-body-sm text-fg">
            {t('business_sign_guest_body')}
          </p>
          <BusinessButton variant="primary" onClick={openLogin}>
            {t('business_sign_in_to_sign')}
          </BusinessButton>
        </div>
      );
    }
    if (!canSign) {
      return null;
    }
    return (
      <div className={businessCardClass({ className: 'flex flex-col gap-4' })}>
        <h2 className="text-body font-weight-strong text-heading">
          {t('business_sign_panel_title')}
        </h2>
        <BusinessDisclosure variant="ledger_start" />
        <BusinessDisclosure variant="auto_payments" />

        {useGuidedForm ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm font-weight-label text-heading">
              {t('business_sign_params_title')}
            </p>
            {signParams.map((param) => (
              <BusinessField
                key={param.key}
                label={param.label}
                required={param.required}
              >
                <input
                  type="text"
                  value={signValues[param.key] ?? ''}
                  onChange={(e) =>
                    setSignValues((prev) => ({
                      ...prev,
                      [param.key]: e.target.value,
                    }))
                  }
                  className={BUSINESS_FIELD_CLASS}
                />
              </BusinessField>
            ))}
            {missingRequired.length > 0 ? (
              <p className="text-caption text-fg-secondary">
                {t('business_sign_params_required_missing')}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <BusinessDisclosure variant="sign_metadata_hint" />
            <ObjectBuilder
              value={{}}
              label={t('business_sign_metadata_label')}
              disabled={isBusy}
              onChange={(next, valid) => {
                setMetadata(next);
                setMetadataValid(valid);
              }}
            />
          </>
        )}

        <label className="flex items-start gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className={`mt-0.5 size-4 shrink-0 accent-accent ${BUSINESS_FOCUS_RING}`}
          />
          {t('business_sign_ack')}
        </label>
        {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
        <BusinessActionError message={error} />
        <BusinessButton
          variant="primary"
          busy={isBusy}
          disabled={!canSubmitSign}
          onClick={() => void onSign()}
        >
          {t('business_sign_contract')}
        </BusinessButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-container-page px-gutter py-section-y-sm sm:px-gutter-sm">
      <Link
        href={catalogHref}
        className={`mb-card-padding inline-flex min-h-9 items-center gap-1 rounded-btn text-body-sm text-link hover:underline ${BUSINESS_FOCUS_RING}`}
        suppressHydrationWarning
      >
        <ChevronLeftIcon size={16} className="rtl:rotate-180" />
        {t('business_back_to_market')}
      </Link>

      <div className="grid items-start gap-card-padding lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="flex min-w-0 flex-col gap-card-padding">
          <header className={businessCardClass()}>
            <div className="flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
              <span>{t(`business_kind_label_${offer.kind}`)}</span>
              <span aria-hidden>·</span>
              <span>
                {t('business_version_short', { version: offer.version })}
              </span>
              <StateBadge variant={isActive ? 'active' : 'retired'} />
            </div>
            <h1
              className={`mt-2 text-section font-display font-weight-display leading-display text-heading ${BUSINESS_BREAK_TEXT}`}
            >
              {offer.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/@${encodeURIComponent(offer.author)}`}
                className={`inline-flex min-w-0 items-center gap-2 rounded-btn text-body-sm text-fg hover:underline ${BUSINESS_FOCUS_RING}`}
                suppressHydrationWarning
              >
                <UserAvatar username={offer.author} size={AUTHOR_AVATAR_SIZE} />
                <span className={BUSINESS_BREAK_TEXT}>@{offer.author}</span>
              </Link>
              <p className="text-body font-weight-strong tabular-nums text-heading">
                {priceLabel(commercial)}
              </p>
            </div>
            {offer.description ? (
              <p
                className={`mt-card-padding whitespace-pre-wrap text-body text-fg ${BUSINESS_BREAK_TEXT}`}
              >
                {offer.description}
              </p>
            ) : null}
            {offer.tags.length > 0 ? (
              <ul
                className="mt-3 flex flex-wrap gap-1.5"
                aria-label={t('business_field_tags')}
              >
                {offer.tags.map((tag) => (
                  <li
                    key={tag}
                    className="max-w-full truncate rounded-pill bg-surface-control px-2 py-0.5 text-caption text-fg"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          <OfferTermsSummary
            terms={offer.terms}
            disputeRule={offer.dispute_rule}
            arbiter={offer.arbiter}
            serviceRef={offer.service_ref}
            legalRef={offer.legal_ref}
          />
          {offer.legal_ref ? (
            <BusinessDisclosure variant="legal_ref_warning" />
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-card-padding lg:sticky lg:top-[calc(var(--shell-header-height)+var(--spacing-card))]">
          {signPanel()}
        </aside>
      </div>
    </div>
  );
}
