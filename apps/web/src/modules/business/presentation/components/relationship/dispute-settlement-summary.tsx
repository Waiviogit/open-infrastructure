'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { formatUsd } from '../../../domain/usd-format';
import type {
  LedgerDisputeRow,
  LedgerInvoiceRow,
} from '../../../domain/ledger.types';

export type DisputeSettlementSummaryProps = {
  dispute: LedgerDisputeRow;
  invoice: LedgerInvoiceRow | undefined;
};

function SettlementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
      <dt>{label}</dt>
      <dd className="tabular-nums text-fg">{value}</dd>
    </div>
  );
}

export function DisputeSettlementSummary({
  dispute,
  invoice,
}: DisputeSettlementSummaryProps) {
  const { t } = useI18n();
  const originalUsd = invoice?.amount_usd;
  const proposedUsd = dispute.proposed_amount_usd;
  const finalUsd =
    dispute.final_amount_usd ?? invoice?.final_amount_usd ?? null;
  const isResolved = dispute.status === 'resolved';

  return (
    <div className="mt-2 max-w-sm">
      <dl className="grid gap-1 text-caption text-fg-secondary">
        <SettlementRow
          label={t('business_field_original_amount')}
          value={formatUsd(originalUsd)}
        />
        <SettlementRow
          label={t('business_dispute_proposed_by').replace(
            '@account',
            `@${dispute.disputant}`,
          )}
          value={formatUsd(proposedUsd)}
        />
        {isResolved && finalUsd != null ? (
          <>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
              <dt>{t('business_field_final_amount')}</dt>
              <dd className="tabular-nums font-weight-strong text-heading">
                {formatUsd(finalUsd)}
              </dd>
            </div>
            {dispute.resolver ? (
              <SettlementRow
                label={t('business_field_resolver')}
                value={`@${dispute.resolver}`}
              />
            ) : null}
          </>
        ) : null}
      </dl>
      {isResolved && finalUsd != null ? null : (
        <p className="mt-1 text-caption text-fg-secondary">
          {t('business_dispute_awaiting_resolution')}
        </p>
      )}
    </div>
  );
}
