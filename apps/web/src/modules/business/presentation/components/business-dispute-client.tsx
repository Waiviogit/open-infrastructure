'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useOblCustomJsonId } from '@/config/odl-network-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';

import { buildResolveDisputeOp } from '../../application/build-obl-ops';
import {
  canViewerResolveDispute,
  disputeAuthorityForInvoice,
} from '../../domain/dispute-resolution';
import { contractDisplayLabel } from '../../domain/contract-label';
import { toLedgerContractRow } from '../../domain/ledger-contract';
import { ledgerDetailsSummary } from '../../domain/ledger-display';
import { formatUsd } from '../../domain/usd-format';
import type { LedgerInvoiceRow } from '../../domain/ledger.types';
import { businessRoutes } from '../../domain/routes';
import type { OblDisputeDetailApiResponse } from '../../infrastructure/clients/obl-ledger.server';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessResolveDisputeModal } from './relationship/business-resolve-dispute-modal';
import { DisputeSettlementSummary } from './relationship/dispute-settlement-summary';
import { StateBadge } from './state-badge';
import { BusinessButton } from '../ui/business-button';
import { BusinessActionError } from '../ui/business-states';
import { BusinessDetailSection } from '../ui/business-detail-list';
import {
  LedgerBreadcrumbs,
  LedgerPartiesSection,
  LedgerTechnicalDetails,
  pairCounterparty,
} from './ledger-detail-parts';

export function BusinessDisputeClient({
  username,
  detail,
}: {
  username: string;
  detail: OblDisputeDetailApiResponse;
}) {
  const { t } = useI18n();
  const oblCustomJsonId = useOblCustomJsonId();
  const { dispute, invoice, contract } = detail;
  const [resolveOpen, setResolveOpen] = useState(false);
  const { broadcast, isBusy, phase, error, setError } =
    useOblBroadcast(username);

  const ledgerInvoice = invoice as LedgerInvoiceRow;
  const ledgerContract = useMemo(
    () => (contract ? toLedgerContractRow(contract) : null),
    [contract],
  );
  const canResolve = useMemo(
    () =>
      canViewerResolveDispute(username, dispute, [], [], {
        invoice: ledgerInvoice,
        governingContract: ledgerContract,
      }),
    [username, dispute, ledgerInvoice, ledgerContract],
  );
  const resolveAuthority = useMemo(() => {
    if (!ledgerContract) {
      return null;
    }
    return disputeAuthorityForInvoice(ledgerInvoice, [], ledgerContract);
  }, [ledgerContract, ledgerInvoice]);

  async function submitResolve(finalAmountUsd: string): Promise<boolean> {
    const txId = await broadcast(
      [
        buildResolveDisputeOp({
          oblCustomJsonId,
          disputeId: dispute.dispute_id,
          resolver: username,
          finalAmountUsd,
        }),
      ],
      {
        refreshDisputeResolution: true,
        disputeId: dispute.dispute_id,
        invoiceId: invoice.invoice_id,
        contractId: contract?.contract_id,
        ledgerPairs: contract
          ? [{ accountA: contract.provider, accountB: contract.client }]
          : undefined,
      },
    );
    return txId !== null;
  }

  const counterparty =
    (contract
      ? pairCounterparty(username, contract.provider, contract.client)
      : null) ?? pairCounterparty(username, invoice.debtor, invoice.creditor);
  const title =
    ledgerDetailsSummary(invoice.details) ??
    (contract
      ? contractDisplayLabel(contract)
      : t('business_dispute_untitled'));

  return (
    <>
      <BusinessPageShell
        variant="entity"
        title={title}
        subtitle={t('business_dispute_subtitle')}
        breadcrumbs={
          <LedgerBreadcrumbs
            counterparty={counterparty}
            current={t('business_field_dispute')}
          />
        }
        actions={
          canResolve ? (
            <BusinessButton
              variant="primary"
              disabled={isBusy}
              onClick={() => {
                setError(null);
                setResolveOpen(true);
              }}
            >
              {t('business_dispute_resolve_action')}
            </BusinessButton>
          ) : null
        }
      >
        <div className="flex flex-col gap-card-padding">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge
              variant={dispute.status === 'open' ? 'disputed' : 'resolved'}
            />
            {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
          </div>
          {resolveOpen ? null : <BusinessActionError message={error} />}
          <BusinessDetailSection
            title={t('business_section_settlement')}
            rows={[]}
          >
            <DisputeSettlementSummary
              dispute={dispute}
              invoice={ledgerInvoice}
            />
          </BusinessDetailSection>
          <LedgerPartiesSection
            viewer={username}
            parties={[
              { role: t('business_field_debtor'), account: invoice.debtor },
              { role: t('business_field_creditor'), account: invoice.creditor },
              ...(contract?.arbiter
                ? [
                    {
                      role: t('business_field_arbiter'),
                      account: contract.arbiter,
                    },
                  ]
                : []),
            ]}
          />
          <BusinessDetailSection
            title={t('business_section_linked')}
            rows={[
              {
                label: t('business_field_invoice'),
                value: (
                  <Link
                    href={businessRoutes.invoice(invoice.invoice_id)}
                    className="text-link hover:underline"
                    suppressHydrationWarning
                  >
                    {ledgerDetailsSummary(invoice.details) ??
                      formatUsd(invoice.amount_usd)}
                  </Link>
                ),
              },
              ...(contract
                ? [
                    {
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
                    },
                  ]
                : []),
            ]}
          />
          <LedgerTechnicalDetails
            ids={[
              { label: t('business_field_dispute'), id: dispute.dispute_id },
              { label: t('business_field_invoice'), id: invoice.invoice_id },
              {
                label: t('business_field_transaction_id'),
                id: dispute.transaction_id,
              },
            ]}
            createdAt={dispute.created_at}
          />
        </div>
      </BusinessPageShell>

      <BusinessResolveDisputeModal
        open={resolveOpen}
        dispute={dispute}
        invoice={ledgerInvoice}
        authority={resolveAuthority}
        onClose={() => setResolveOpen(false)}
        isBusy={isBusy}
        error={error}
        onSubmit={(_dispute, finalAmountUsd) => submitResolve(finalAmountUsd)}
      />
    </>
  );
}
