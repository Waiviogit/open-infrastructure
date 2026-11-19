'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';

import {
  contractDisplayLabel,
  reportDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../domain/contract-label';
import {
  invoiceBadgeState,
  ledgerDetailsSummary,
} from '../../domain/ledger-display';
import { formatUsd } from '../../domain/usd-format';
import { businessRoutes } from '../../domain/routes';
import type { OblInvoiceDetailApiResponse } from '../../infrastructure/clients/obl-ledger.server';
import { BusinessPageShell } from '../layout/business-page-shell';
import {
  BusinessDetailSection,
  type BusinessDetailRow,
} from '../ui/business-detail-list';
import {
  LedgerBreadcrumbs,
  LedgerDetailsSection,
  LedgerPartiesSection,
  LedgerTechnicalDetails,
  pairCounterparty,
} from './ledger-detail-parts';
import { InvoiceObligationLinesTable } from './relationship/invoice-obligation-lines-table';
import { StateBadge } from './state-badge';

function linkValue(href: string, label: string) {
  return (
    <Link
      href={href}
      className="text-link hover:underline"
      suppressHydrationWarning
    >
      {label}
    </Link>
  );
}

export function BusinessInvoiceClient({
  username,
  detail,
}: {
  username: string;
  detail: OblInvoiceDetailApiResponse;
}) {
  const { t } = useI18n();
  const { invoice, contract, serviceOrder, report } = detail;
  const lines = invoice.lines ?? [];
  const isMulti = invoice.kind === 'multi' || lines.length > 1;
  const settled =
    invoice.state === 'resolved' &&
    invoice.final_amount_usd != null &&
    invoice.final_amount_usd !== '';
  const contracts = contract ? [contract] : [];
  const title =
    ledgerDetailsSummary(invoice.details) ??
    (contract ? contractDisplayLabel(contract) : t('business_field_invoice'));
  const counterparty =
    pairCounterparty(username, invoice.debtor, invoice.creditor) ??
    (contract
      ? pairCounterparty(username, contract.provider, contract.client)
      : null);

  const linkRows: BusinessDetailRow[] = [];
  if (contract) {
    linkRows.push({
      label: t('business_field_contract'),
      value: linkValue(
        businessRoutes.contract(contract.contract_id),
        contractDisplayLabel(contract),
      ),
    });
  }
  if (serviceOrder) {
    linkRows.push({
      label: t('business_field_service_order'),
      value: linkValue(
        businessRoutes.serviceOrder(serviceOrder.service_order_id),
        serviceOrderDisplayLabel(serviceOrder, contracts),
      ),
    });
  }
  if (report) {
    linkRows.push({
      label: t('business_field_report'),
      value: linkValue(
        businessRoutes.report(report.report_id),
        reportDisplayLabel(report, contracts),
      ),
    });
  }

  return (
    <BusinessPageShell
      variant="entity"
      title={title}
      subtitle={t('business_invoice_subtitle')}
      breadcrumbs={
        <LedgerBreadcrumbs
          counterparty={counterparty}
          current={t('business_field_invoice')}
        />
      }
    >
      <div className="flex flex-col gap-card-padding">
        <BusinessDetailSection
          title={t('business_section_amount')}
          rows={[
            {
              label: t('business_field_amount_usd'),
              value: (
                <span className="text-body font-weight-strong tabular-nums text-heading">
                  {settled ? (
                    <>
                      <span className="me-2 text-body-sm font-weight-body text-fg-secondary line-through">
                        {formatUsd(invoice.amount_usd)}
                      </span>
                      {formatUsd(invoice.final_amount_usd)}
                    </>
                  ) : (
                    formatUsd(invoice.amount_usd)
                  )}
                </span>
              ),
            },
            {
              label: t('business_field_state'),
              value: <StateBadge variant={invoiceBadgeState(invoice.state)} />,
            },
          ]}
        >
          {isMulti && lines.length > 0 ? (
            <div className="mt-3">
              <InvoiceObligationLinesTable
                lines={lines}
                totalUsd={invoice.amount_usd}
              />
            </div>
          ) : null}
        </BusinessDetailSection>
        <LedgerPartiesSection
          viewer={username}
          parties={[
            { role: t('business_field_issuer'), account: invoice.issuer },
            { role: t('business_field_debtor'), account: invoice.debtor },
            { role: t('business_field_creditor'), account: invoice.creditor },
          ]}
        />
        {linkRows.length > 0 ? (
          <BusinessDetailSection
            title={t('business_section_linked')}
            rows={linkRows}
          />
        ) : null}
        <LedgerDetailsSection
          title={t('business_invoice_details_label')}
          details={invoice.details}
        />
        <LedgerTechnicalDetails
          ids={[
            { label: t('business_field_invoice'), id: invoice.invoice_id },
            {
              label: t('business_field_service_order'),
              id: invoice.service_order_id,
            },
            { label: t('business_field_report'), id: invoice.report_id },
            {
              label: t('business_field_transaction_id'),
              id: invoice.transaction_id,
            },
          ]}
          createdAt={invoice.created_at}
        />
      </div>
    </BusinessPageShell>
  );
}
