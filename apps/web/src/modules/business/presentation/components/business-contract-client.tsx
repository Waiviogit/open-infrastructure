'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';

import {
  contractDisplayLabel,
  disputeRuleLabelKey,
} from '../../domain/contract-label';
import { businessRoutes } from '../../domain/routes';
import type { OblContractApiRow } from '../../infrastructure/clients/obl-ledger.server';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessAccountLink } from '../ui/business-account-link';
import { BusinessDetailSection } from '../ui/business-detail-list';
import {
  LedgerBreadcrumbs,
  LedgerDetailsSection,
  LedgerPartiesSection,
  LedgerTechnicalDetails,
  pairCounterparty,
} from './ledger-detail-parts';
import { StateBadge } from './state-badge';

export function BusinessContractClient({
  username,
  contract,
}: {
  username: string;
  contract: OblContractApiRow;
}) {
  const { t } = useI18n();
  const title = contractDisplayLabel(contract);
  const description = contract.offer_description?.trim() || null;

  return (
    <BusinessPageShell
      variant="entity"
      title={title}
      subtitle={t('business_contract_subtitle')}
      breadcrumbs={
        <LedgerBreadcrumbs
          counterparty={pairCounterparty(
            username,
            contract.provider,
            contract.client,
          )}
          current={t('business_field_contract')}
        />
      }
    >
      <div className="flex flex-col gap-card-padding">
        {contract.offer_status === 'retired' ? (
          <div>
            <StateBadge variant="retired" />
          </div>
        ) : null}
        <LedgerPartiesSection
          viewer={username}
          parties={[
            { role: t('business_field_provider'), account: contract.provider },
            { role: t('business_field_client'), account: contract.client },
          ]}
        />
        <BusinessDetailSection
          title={t('business_section_terms')}
          rows={[
            ...(description
              ? [
                  {
                    label: t('business_field_description'),
                    value: (
                      <span className="whitespace-pre-wrap">{description}</span>
                    ),
                    wide: true,
                  },
                ]
              : []),
            {
              label: t('business_field_offer'),
              value: (
                <Link
                  href={businessRoutes.offerDetail(contract.offer_id)}
                  className="text-link hover:underline"
                  suppressHydrationWarning
                >
                  {t('business_open_version').replace(
                    '{version}',
                    String(contract.offer_version),
                  )}
                </Link>
              ),
            },
            {
              label: t('business_field_dispute_rule'),
              value: t(disputeRuleLabelKey(contract.dispute_rule)),
            },
            ...(contract.arbiter
              ? [
                  {
                    label: t('business_field_arbiter'),
                    value: <BusinessAccountLink account={contract.arbiter} />,
                  },
                ]
              : []),
          ]}
        />
        <LedgerDetailsSection
          title={t('business_sign_metadata_label')}
          details={contract.metadata}
        />
        <LedgerTechnicalDetails
          ids={[
            { label: t('business_field_contract'), id: contract.contract_id },
            { label: t('business_field_offer'), id: contract.offer_id },
            {
              label: t('business_field_transaction_id'),
              id: contract.transaction_id,
            },
          ]}
          createdAt={contract.created_at}
        />
      </div>
    </BusinessPageShell>
  );
}
