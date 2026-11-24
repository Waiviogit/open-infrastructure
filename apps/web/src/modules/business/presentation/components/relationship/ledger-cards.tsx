'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';

import {
  invoiceBadgeState,
  ledgerDetailsSummary,
} from '../../../domain/ledger-display';
import type {
  LedgerContractRow,
  LedgerDisputeRow,
  LedgerInvoiceRow,
  LedgerReportRow,
} from '../../../domain/ledger.types';
import { businessRoutes } from '../../../domain/routes';
import { formatUsd } from '../../../domain/usd-format';
import { BusinessButton } from '../../ui/business-button';
import {
  BUSINESS_BREAK_TEXT,
  BUSINESS_FOCUS_RING,
  businessCardClass,
} from '../../ui/classes';
import { CopyableId } from '../../ui/copyable-id';
import { StateBadge } from '../state-badge';
import { DisputeSettlementSummary } from './dispute-settlement-summary';

const DESCRIPTION_LINES_CLASS = 'line-clamp-3';

/** Shared card frame: title row + badges on the left, amount / id on the right. */
function LedgerCard({
  title,
  href,
  badges,
  meta,
  aside,
  children,
}: {
  title: string;
  href: string;
  badges?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className={businessCardClass()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-card-padding">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
            >
              <Link
                href={href}
                className={`rounded-btn hover:underline ${BUSINESS_FOCUS_RING}`}
                suppressHydrationWarning
              >
                {title}
              </Link>
            </h3>
            {badges}
          </div>
          {meta ? (
            <div className="mt-0.5 text-caption text-fg-secondary">{meta}</div>
          ) : null}
        </div>
        {aside ? (
          <div className="flex shrink-0 flex-col gap-1 sm:items-end">
            {aside}
          </div>
        ) : null}
      </div>
      {children}
    </article>
  );
}

function ContractLine({
  label,
  href,
}: {
  label: string | null;
  href: string | null;
}) {
  const { t } = useI18n();
  if (!label) {
    return null;
  }
  return (
    <p className={`mt-1 text-caption text-fg-secondary ${BUSINESS_BREAK_TEXT}`}>
      {t('business_invoice_contract_label')}:{' '}
      {href ? (
        <Link
          href={href}
          className="text-link hover:underline"
          suppressHydrationWarning
        >
          {label}
        </Link>
      ) : (
        label
      )}
    </p>
  );
}

export function LedgerInvoiceCard({
  invoice,
  contractLabel,
  disputable,
  isBusy,
  onDispute,
}: {
  invoice: LedgerInvoiceRow;
  contractLabel: string | null;
  disputable: boolean;
  isBusy: boolean;
  onDispute: () => void;
}) {
  const { t } = useI18n();
  const settled =
    invoice.state === 'resolved' &&
    invoice.final_amount_usd != null &&
    invoice.final_amount_usd !== '';
  const title =
    ledgerDetailsSummary(invoice.details) ??
    contractLabel ??
    t('business_field_invoice');

  return (
    <LedgerCard
      title={title}
      href={businessRoutes.invoice(invoice.invoice_id)}
      badges={
        <>
          <StateBadge variant={invoiceBadgeState(invoice.state)} />
          {invoice.kind === 'multi' ? (
            <span className="rounded-pill bg-surface-control px-2 py-0.5 text-caption text-fg">
              {t('business_invoice_kind_multi')}
            </span>
          ) : null}
        </>
      }
      meta={
        <>
          {t('business_invoice_parties', {
            debtor: `@${invoice.debtor}`,
            creditor: `@${invoice.creditor}`,
          })}
          {' · '}
          <ActivityTimestamp timestamp={invoice.created_at} />
        </>
      }
      aside={
        <>
          <p className="text-body font-weight-strong tabular-nums text-heading">
            {settled ? (
              <>
                <span className="me-1 text-body-sm font-weight-body text-fg-secondary line-through">
                  {formatUsd(invoice.amount_usd)}
                </span>
                {formatUsd(invoice.final_amount_usd)}
              </>
            ) : (
              formatUsd(invoice.amount_usd)
            )}
          </p>
          <CopyableId id={invoice.invoice_id} />
        </>
      }
    >
      <ContractLine
        label={contractLabel}
        href={
          invoice.contract_id
            ? businessRoutes.contract(invoice.contract_id)
            : null
        }
      />
      {disputable ? (
        <BusinessButton
          size="sm"
          className="mt-3"
          disabled={isBusy}
          onClick={onDispute}
        >
          {t('business_invoice_dispute_action')}
        </BusinessButton>
      ) : null}
    </LedgerCard>
  );
}

export function LedgerDisputeCard({
  dispute,
  invoice,
  contractLabel,
  contractId,
  resolvable,
  isBusy,
  onResolve,
}: {
  dispute: LedgerDisputeRow;
  invoice: LedgerInvoiceRow | undefined;
  contractLabel: string | null;
  contractId: string | null;
  resolvable: boolean;
  isBusy: boolean;
  onResolve: () => void;
}) {
  const { t } = useI18n();
  const title =
    (invoice ? ledgerDetailsSummary(invoice.details) : null) ??
    contractLabel ??
    t('business_dispute_untitled');

  return (
    <LedgerCard
      title={title}
      href={businessRoutes.dispute(dispute.dispute_id)}
      badges={
        <StateBadge
          variant={dispute.status === 'open' ? 'disputed' : 'resolved'}
        />
      }
      meta={
        <>
          {t('business_dispute_opened_by', {
            account: `@${dispute.disputant}`,
          })}
          {' · '}
          <ActivityTimestamp timestamp={dispute.created_at} />
        </>
      }
      aside={<CopyableId id={dispute.dispute_id} />}
    >
      <ContractLine
        label={contractLabel}
        href={contractId ? businessRoutes.contract(contractId) : null}
      />
      <DisputeSettlementSummary dispute={dispute} invoice={invoice} />
      {resolvable ? (
        <BusinessButton
          variant="primary"
          size="sm"
          className="mt-3"
          disabled={isBusy}
          onClick={onResolve}
        >
          {t('business_dispute_resolve_action')}
        </BusinessButton>
      ) : null}
    </LedgerCard>
  );
}

export function LedgerContractCard({
  contract,
  label,
  descriptionPreview,
}: {
  contract: LedgerContractRow;
  label: string;
  descriptionPreview: string | null;
}) {
  const { t } = useI18n();
  return (
    <LedgerCard
      title={label}
      href={businessRoutes.contract(contract.contract_id)}
      badges={
        contract.offer_status === 'retired' ? (
          <StateBadge variant="retired" />
        ) : null
      }
      meta={
        <>
          {t('business_contract_parties', {
            provider: `@${contract.provider}`,
            client: `@${contract.client}`,
          })}
          {' · '}
          <ActivityTimestamp timestamp={contract.created_at} />
        </>
      }
      aside={<CopyableId id={contract.contract_id} />}
    >
      {descriptionPreview ? (
        <p
          className={`mt-2 text-body-sm text-fg ${DESCRIPTION_LINES_CLASS} ${BUSINESS_BREAK_TEXT}`}
        >
          {descriptionPreview}
        </p>
      ) : null}
    </LedgerCard>
  );
}

export function LedgerReportCard({
  report,
  contractLabel,
  serviceOrderLabel,
}: {
  report: LedgerReportRow;
  contractLabel: string | null;
  serviceOrderLabel: string | null;
}) {
  const { t } = useI18n();
  const title =
    ledgerDetailsSummary(report.details) ??
    contractLabel ??
    t('business_field_report');
  return (
    <LedgerCard
      title={title}
      href={businessRoutes.report(report.report_id)}
      meta={
        <>
          {t('business_report_by', { account: `@${report.author}` })}
          {' · '}
          <ActivityTimestamp timestamp={report.created_at} />
        </>
      }
      aside={<CopyableId id={report.report_id} />}
    >
      <ContractLine
        label={contractLabel}
        href={
          report.contract_id
            ? businessRoutes.contract(report.contract_id)
            : null
        }
      />
      {serviceOrderLabel && report.service_order_id ? (
        <p
          className={`mt-1 text-caption text-fg-secondary ${BUSINESS_BREAK_TEXT}`}
        >
          {t('business_field_service_order')}:{' '}
          <Link
            href={businessRoutes.serviceOrder(report.service_order_id)}
            className="text-link hover:underline"
            suppressHydrationWarning
          >
            {serviceOrderLabel}
          </Link>
        </p>
      ) : null}
    </LedgerCard>
  );
}
