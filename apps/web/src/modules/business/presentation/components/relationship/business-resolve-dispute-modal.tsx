'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { sumBeneficiaryAmounts } from '../../../domain/invoice-issue';
import type {
  LedgerDisputeRow,
  LedgerInvoiceRow,
} from '../../../domain/ledger.types';
import type { DisputeAuthority } from '../../../domain/dispute-resolution';
import { formatUsd } from '../../../domain/usd-format';
import { fetchOblInvoiceDetailClient } from '../../../infrastructure/clients/obl-ledger.client';
import type { OblObligationLineApiRow } from '../../../infrastructure/clients/obl-ledger.server';
import { BUSINESS_CALLOUT_CLASS, BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessButton } from '../../ui/business-button';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { CopyableId } from '../../ui/copyable-id';
import { InvoiceObligationLinesTable } from './invoice-obligation-lines-table';
import {
  RelationshipReadonlyField,
  parseNonNegativeUsdAmount,
} from './relationship-modal-fields';

const REJECT_ALL_AMOUNT_USD = '0';

export type BusinessResolveDisputeModalProps = {
  open: boolean;
  dispute: LedgerDisputeRow | null;
  invoice: LedgerInvoiceRow | null;
  authority: DisputeAuthority | null;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (
    dispute: LedgerDisputeRow,
    finalAmountUsd: string,
  ) => Promise<boolean>;
};

export function BusinessResolveDisputeModal({
  open,
  dispute,
  invoice,
  authority,
  onClose,
  isBusy,
  error,
  onSubmit,
}: BusinessResolveDisputeModalProps) {
  const { t } = useI18n();
  const [finalAmount, setFinalAmount] = useState('');
  const [lines, setLines] = useState<OblObligationLineApiRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  /** "Reject all" zeroes every line: it needs an explicit second confirmation. */
  const [rejectArmed, setRejectArmed] = useState(false);

  const isMultiKnown = invoice?.kind === 'multi';
  const linesLoadedMulti = lines.length > 1;
  const multiTotal = linesLoadedMulti
    ? sumBeneficiaryAmounts(lines.map((l) => ({ amountUsd: l.amount_usd })))
    : null;
  const canSubmitMulti =
    linesLoadedMulti && multiTotal !== null && !detailLoading && !detailError;

  useEffect(() => {
    if (!open || !dispute) {
      return;
    }
    setFinalAmount(dispute.proposed_amount_usd);
    setLines([]);
    setDetailError(null);
    setRejectArmed(false);
    setDetailLoading(true);
    void fetchOblInvoiceDetailClient(dispute.invoice_id)
      .then((detail) => {
        const invoiceLines = detail.invoice.lines ?? [];
        setLines(invoiceLines);
        if (invoiceLines.length > 1) {
          setFinalAmount(
            sumBeneficiaryAmounts(
              invoiceLines.map((l) => ({ amountUsd: l.amount_usd })),
            ),
          );
        }
      })
      .catch(() => {
        setDetailError(t('business_invoice_detail_load_failed'));
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, [open, dispute, t]);

  const canSubmitSingle =
    dispute !== null &&
    !isMultiKnown &&
    !linesLoadedMulti &&
    !detailLoading &&
    parseNonNegativeUsdAmount(finalAmount);

  if (!dispute || !authority) {
    return null;
  }

  const ruleLabel =
    authority.rule === 'arbiter'
      ? t('business_dispute_arbiter')
      : authority.rule === 'provider'
        ? t('business_dispute_provider')
        : t('business_dispute_client');

  const activeDispute = dispute;
  const multiMode = linesLoadedMulti && multiTotal !== null;

  function submitLabel(): string {
    if (rejectArmed) {
      return t('business_dispute_reject_all_confirm');
    }
    return multiMode
      ? t('business_dispute_accept_all')
      : t('business_dispute_resolve_action');
  }

  function submit(): Promise<boolean> {
    if (rejectArmed) {
      return onSubmit(activeDispute, REJECT_ALL_AMOUNT_USD);
    }
    return onSubmit(activeDispute, multiTotal ?? finalAmount);
  }

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_modal_resolve_dispute_title')}
      busy={isBusy}
      error={error}
      submitLabel={submitLabel()}
      submitVariant={rejectArmed ? 'destructive' : 'primary'}
      canSubmit={multiMode ? canSubmitMulti : canSubmitSingle}
      onSubmit={submit}
      maxWidthClass="max-w-lg"
      footerStart={
        multiMode ? (
          rejectArmed ? (
            <BusinessButton
              variant="ghost"
              disabled={isBusy}
              onClick={() => setRejectArmed(false)}
            >
              {t('business_back')}
            </BusinessButton>
          ) : (
            <BusinessButton
              variant="destructive"
              disabled={!canSubmitMulti || isBusy}
              onClick={() => setRejectArmed(true)}
            >
              {t('business_dispute_reject_all')}
            </BusinessButton>
          )
        ) : null
      }
    >
      {rejectArmed ? (
        <p className={`${BUSINESS_CALLOUT_CLASS} border-error`} role="alert">
          {t('business_dispute_reject_all_warning')}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-caption text-fg-secondary">
          {t('business_field_invoice')}
        </span>
        <CopyableId id={dispute.invoice_id} />
      </div>
      {invoice ? (
        <RelationshipReadonlyField
          label={t('business_field_original_amount')}
          value={formatUsd(multiTotal ?? invoice.amount_usd)}
        />
      ) : null}
      {detailLoading ? (
        <p className="text-caption text-fg-secondary" role="status">
          {t('business_loading')}
        </p>
      ) : null}
      {detailError ? (
        <p className="text-caption text-error" role="alert">
          {detailError}
        </p>
      ) : null}
      {linesLoadedMulti ? (
        <InvoiceObligationLinesTable
          lines={lines}
          totalUsd={multiTotal ?? undefined}
        />
      ) : null}
      {(linesLoadedMulti || isMultiKnown) && !detailError ? (
        <p className="text-caption text-fg-secondary">
          {t('business_dispute_multi_resolve_hint')}
        </p>
      ) : null}
      <RelationshipReadonlyField
        label={t('business_field_dispute_rule')}
        value={ruleLabel}
      />
      <RelationshipReadonlyField
        label={t('business_field_resolver')}
        value={`@${authority.resolverAccount}`}
      />
      <RelationshipReadonlyField
        label={t('business_field_proposed_amount')}
        value={formatUsd(dispute.proposed_amount_usd)}
      />
      {!isMultiKnown && !linesLoadedMulti ? (
        <BusinessField label={t('business_field_final_amount')}>
          <input
            type="text"
            inputMode="decimal"
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
            className={BUSINESS_FIELD_CLASS}
          />
        </BusinessField>
      ) : null}
    </BusinessFormModal>
  );
}
