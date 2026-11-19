'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';

import {
  contractDisplayLabel,
  reportDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../domain/contract-label';
import { businessRoutes } from '../../domain/routes';
import type { OblReportDetailApiResponse } from '../../infrastructure/clients/obl-ledger.server';
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

export function BusinessReportClient({
  username,
  detail,
}: {
  username: string;
  detail: OblReportDetailApiResponse;
}) {
  const { t } = useI18n();
  const { report, contract, serviceOrder } = detail;
  const contracts = contract ? [contract] : [];

  const linkRows: BusinessDetailRow[] = [];
  if (contract) {
    linkRows.push({
      label: t('business_field_contract'),
      value: (
        <Link
          href={businessRoutes.contract(contract.contract_id)}
          className="text-link hover:underline"
          suppressHydrationWarning
        >
          {contractDisplayLabel(contract)}
        </Link>
      ),
    });
  }
  if (serviceOrder) {
    linkRows.push({
      label: t('business_field_service_order'),
      value: (
        <Link
          href={businessRoutes.serviceOrder(serviceOrder.service_order_id)}
          className="text-link hover:underline"
          suppressHydrationWarning
        >
          {serviceOrderDisplayLabel(serviceOrder, contracts)}
        </Link>
      ),
    });
  }

  return (
    <BusinessPageShell
      variant="entity"
      title={reportDisplayLabel(report, contracts)}
      subtitle={t('business_report_subtitle')}
      breadcrumbs={
        <LedgerBreadcrumbs
          counterparty={pairCounterparty(
            username,
            report.provider,
            report.client,
          )}
          current={t('business_field_report')}
        />
      }
    >
      <div className="flex flex-col gap-card-padding">
        <LedgerDetailsSection
          title={t('business_report_details_label')}
          details={report.details}
        />
        <LedgerPartiesSection
          viewer={username}
          parties={[
            { role: t('business_field_author'), account: report.author },
            { role: t('business_field_provider'), account: report.provider },
            { role: t('business_field_client'), account: report.client },
          ]}
        />
        {linkRows.length > 0 ? (
          <BusinessDetailSection
            title={t('business_section_linked')}
            rows={linkRows}
          />
        ) : null}
        <LedgerTechnicalDetails
          ids={[
            { label: t('business_field_report'), id: report.report_id },
            {
              label: t('business_field_transaction_id'),
              id: report.transaction_id,
            },
          ]}
          createdAt={report.created_at}
        />
      </div>
    </BusinessPageShell>
  );
}
