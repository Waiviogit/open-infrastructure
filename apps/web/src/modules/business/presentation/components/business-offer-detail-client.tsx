'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';

import { buildRetireOfferOp } from '../../application/build-obl-ops';
import { businessNavIdForKind, businessRoutes } from '../../domain/routes';
import type { OblOfferApiRow } from '../../infrastructure/clients/obl-offers.server';
import { createOblDraftAction } from '../../infrastructure/actions/obl-drafts.actions';
import { BusinessDisclosure } from './business-disclosure';
import { OfferTermsSummary } from './offer-terms-summary';
import { StateBadge } from './state-badge';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessButton } from '../ui/business-button';
import { BusinessConfirmDialog } from '../ui/business-confirm-dialog';
import { BusinessActionError } from '../ui/business-states';

export function BusinessOfferDetailClient({
  username,
  offer,
}: {
  username: string;
  offer: OblOfferApiRow;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const oblCustomJsonId = useOblCustomJsonId();
  const { broadcast, phase, isBusy, error, setError } =
    useOblBroadcast(username);
  const [newVersionErrorKey, setNewVersionErrorKey] = useState<string | null>(
    null,
  );
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const isOwner = username === offer.author;
  const publicHref =
    offer.kind === 'offer'
      ? businessRoutes.publicOffer(offer.offer_id, offer.version)
      : businessRoutes.publicRequest(offer.offer_id, offer.version);

  async function onRetire() {
    const op = buildRetireOfferOp({
      oblCustomJsonId,
      author: username,
      offerId: offer.offer_id,
    });
    const txId = await broadcast([op]);
    if (txId !== null) {
      setRetireOpen(false);
    }
  }

  async function onNewVersion() {
    setNewVersionErrorKey(null);
    setCreatingVersion(true);
    try {
      await createNewVersionDraft();
    } catch {
      setNewVersionErrorKey('business_draft_create_error_generic');
    } finally {
      setCreatingVersion(false);
    }
  }

  async function createNewVersionDraft() {
    const draft = await createOblDraftAction(username, {
      kind: offer.kind,
      fields: {
        offerId: offer.offer_id,
        publishedOfferId: offer.offer_id,
        name: offer.name,
        description: offer.description ?? '',
        tags: offer.tags,
        serviceRef: offer.service_ref ?? undefined,
        legalRef: offer.legal_ref ?? undefined,
        terms: (offer.terms as Record<string, unknown>) ?? {},
        disputeRule: offer.dispute_rule,
        arbiter: offer.arbiter,
      },
    });
    if (draft.ok) {
      const draftId = draft.value.draftId?.trim();
      if (draftId) {
        router.push(businessRoutes.offerDraft(offer.kind, draftId));
        return;
      }
      setNewVersionErrorKey('business_draft_create_error_generic');
      return;
    }
    if (draft.error.code === 'unauthorized') {
      setNewVersionErrorKey('business_draft_create_error_unauthorized');
    } else {
      setNewVersionErrorKey('business_draft_create_error_generic');
    }
  }

  return (
    <BusinessPageShell
      activeNav={businessNavIdForKind(offer.kind)}
      title={offer.name}
      subtitle={t('business_offer_detail_subtitle')}
      actions={
        isOwner ? (
          <>
            {offer.status === 'active' ? (
              <BusinessButton
                variant="destructive"
                disabled={isBusy}
                onClick={() => {
                  setError(null);
                  setRetireOpen(true);
                }}
              >
                {t('business_retire_offer')}
              </BusinessButton>
            ) : null}
            <BusinessButton
              variant="primary"
              busy={creatingVersion}
              onClick={() => void onNewVersion()}
            >
              {t('business_new_version')}
            </BusinessButton>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge
            variant={offer.status === 'active' ? 'active' : 'retired'}
          />
          <span className="text-caption text-fg-secondary">
            {t(`business_kind_label_${offer.kind}`)} · v{offer.version}
          </span>
        </div>

        {offer.description ? (
          <p className="whitespace-pre-wrap break-words text-body text-fg">
            {offer.description}
          </p>
        ) : null}

        <OfferTermsSummary
          terms={offer.terms}
          disputeRule={offer.dispute_rule}
          arbiter={offer.arbiter}
          serviceRef={offer.service_ref}
          legalRef={offer.legal_ref}
        />

        <BusinessDisclosure variant="immutable_version" />
        {offer.legal_ref ? (
          <BusinessDisclosure variant="legal_ref_warning" />
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href={publicHref} className="text-body-sm text-link">
            {t('business_public_link')}
          </Link>
          <Link
            href={businessRoutes.offerVersion(offer.offer_id, offer.version)}
            className="text-body-sm text-link"
          >
            {t('business_open_version').replace(
              '{version}',
              String(offer.version),
            )}
          </Link>
        </div>

        {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
        {retireOpen ? null : <BusinessActionError message={error} />}
        {newVersionErrorKey ? (
          <p className="text-body-sm text-error" role="alert">
            {t(newVersionErrorKey)}
          </p>
        ) : null}
      </div>
      <BusinessConfirmDialog
        open={retireOpen}
        title={t('business_retire_confirm_title')}
        description={t('business_retire_confirm_body')}
        confirmLabel={t('business_retire_offer')}
        destructive
        busy={isBusy}
        error={error}
        onConfirm={() => void onRetire()}
        onClose={() => setRetireOpen(false)}
      />
    </BusinessPageShell>
  );
}
