'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { sumBeneficiaryAmounts } from '../../../domain/invoice-issue';
import type { LedgerInvoiceRow } from '../../../domain/ledger.types';
import { formatUsd } from '../../../domain/usd-format';
import { fetchOblInvoiceDetailClient } from '../../../infrastructure/clients/obl-ledger.client';
import type { OblObligationLineApiRow } from '../../../infrastructure/clients/obl-ledger.server';
import { BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { CopyableId } from '../../ui/copyable-id';
import { InvoiceObligationLinesTable } from './invoice-obligation-lines-table';
import {
  RelationshipReadonlyField,
  parseNonNegativeUsdAmount,
} from './relationship-modal-fields';

export type BusinessOpenDisputeModalProps = {
  open: boolean;
  invoice: LedgerInvoiceRow | null;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (
    invoice: LedgerInvoiceRow,
    proposedAmountUsd: string,
  ) => Promise<boolean>;
};

export function BusinessOpenDisputeModal({
  open,
  invoice,
  onClose,
  isBusy,
  error,
  onSubmit,
}: BusinessOpenDisputeModalProps) {
  const { t } = useI18n();
  const [proposedAmount, setProposedAmount] = useState('');
  const [lines, setLines] = useState<OblObligationLineApiRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const isMultiKnown = invoice?.kind === 'multi';
  const linesLoadedMulti = lines.length > 1;
  const isMulti = linesLoadedMulti || isMultiKnown;
  const multiTotal = linesLoadedMulti
    ? sumBeneficiaryAmounts(lines.map((l) => ({ amountUsd: l.amount_usd })))
    : null;

  useEffect(() => {
    if (!invoice) {
      return;
    }
    setProposedAmount(invoice.amount_usd);
    setLines([]);
    setDetailError(null);
    if (!open) {
      return;
    }
    setDetailLoading(true);
    void fetchOblInvoiceDetailClient(invoice.invoice_id)
      .then((detail) => {
        const invoiceLines = detail.invoice.lines ?? [];
        setLines(invoiceLines);
        if (invoiceLines.length > 1) {
          setProposedAmount(
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
  }, [invoice, open, t]);

  const canSubmit =
    invoice !== null &&
    parseNonNegativeUsdAmount(proposedAmount) &&
    !(
      isMultiKnown &&
      (detailLoading || detailError !== null || !linesLoadedMulti)
    );

  if (!invoice) {
    return null;
  }

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_modal_open_dispute_title')}
      busy={isBusy}
      error={error}
      submitLabel={t('business_invoice_dispute_action')}
      canSubmit={canSubmit}
      onSubmit={() => onSubmit(invoice, proposedAmount)}
      maxWidthClass="max-w-lg"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-caption text-fg-secondary">
          {t('business_field_invoice')}
        </span>
        <CopyableId id={invoice.invoice_id} />
      </div>
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
      ) : !isMultiKnown ? (
        <>
          <RelationshipReadonlyField
            label={t('business_field_original_amount')}
            value={formatUsd(invoice.amount_usd)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <RelationshipReadonlyField
              label={t('business_field_debtor')}
              value={`@${invoice.debtor}`}
            />
            <RelationshipReadonlyField
              label={t('business_field_creditor')}
              value={`@${invoice.creditor}`}
            />
          </div>
        </>
      ) : null}
      <BusinessField
        label={t('business_field_proposed_amount')}
        hint={isMulti ? t('business_dispute_multi_proposed_hint') : undefined}
      >
        <input
          type="text"
          inputMode="decimal"
          value={proposedAmount}
          onChange={(e) => setProposedAmount(e.target.value)}
          disabled={isMulti}
          className={BUSINESS_FIELD_CLASS}
        />
      </BusinessField>
    </BusinessFormModal>
  );
}
