'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';

import { buildCancelServiceOrderOp } from '../../application/build-obl-ops';
import {
  contractDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../domain/contract-label';
import { businessRoutes } from '../../domain/routes';
import {
  canCancelServiceOrder,
  serviceOrderStatus,
} from '../../domain/service-order-cancel';
import type { OblServiceOrderDetailApiResponse } from '../../infrastructure/clients/obl-ledger.server';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessButton } from '../ui/business-button';
import { BusinessConfirmDialog } from '../ui/business-confirm-dialog';
import { BusinessActionError } from '../ui/business-states';
import { BusinessDetailSection } from '../ui/business-detail-list';
import {
  LedgerBreadcrumbs,
  LedgerDetailsSection,
  LedgerPartiesSection,
  LedgerTechnicalDetails,
  pairCounterparty,
} from './ledger-detail-parts';
import { StateBadge } from './state-badge';

export function BusinessServiceOrderClient({
  username,
  detail,
}: {
  username: string;
  detail: OblServiceOrderDetailApiResponse;
}) {
  const { t } = useI18n();
  const { serviceOrder, contract } = detail;
  const counterparty =
    username === serviceOrder.provider
      ? serviceOrder.client
      : serviceOrder.provider;
  const oblCustomJsonId = useOblCustomJsonId();
  const { broadcast, isBusy, phase, error, setError } = useOblBroadcast(
    username,
    counterparty,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelled = serviceOrderStatus(serviceOrder) === 'cancelled';
  const showCancel = canCancelServiceOrder(serviceOrder, username);

  async function onCancel() {
    const txId = await broadcast(
      [
        buildCancelServiceOrderOp({
          oblCustomJsonId,
          serviceOrderId: serviceOrder.service_order_id,
          username,
        }),
      ],
      { serviceOrderId: serviceOrder.service_order_id },
    );
    if (txId !== null) {
      setConfirmOpen(false);
    }
  }

  const contracts = contract ? [contract] : [];

  return (
    <BusinessPageShell
      variant="entity"
      title={serviceOrderDisplayLabel(serviceOrder, contracts)}
      subtitle={t('business_service_order_subtitle')}
      breadcrumbs={
        <LedgerBreadcrumbs
          counterparty={pairCounterparty(
            username,
            serviceOrder.provider,
            serviceOrder.client,
          )}
          current={t('business_field_service_order')}
        />
      }
      actions={
        showCancel ? (
          <BusinessButton
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            {t('business_cancel_service_order')}
          </BusinessButton>
        ) : null
      }
    >
      <div className="flex flex-col gap-card-padding">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge variant={cancelled ? 'cancelled' : 'active'} />
          {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
          {cancelled && serviceOrder.cancelled_by ? (
            <span className="text-caption text-fg-secondary">
              {t('business_service_order_cancelled_by', {
                account: `@${serviceOrder.cancelled_by}`,
              })}
            </span>
          ) : null}
        </div>
        {confirmOpen ? null : <BusinessActionError message={error} />}
        <LedgerDetailsSection
          title={t('business_service_order_details_label')}
          details={serviceOrder.details}
        />
        <LedgerPartiesSection
          viewer={username}
          parties={[
            {
              role: t('business_field_creator'),
              account: serviceOrder.creator,
            },
            {
              role: t('business_field_provider'),
              account: serviceOrder.provider,
            },
            { role: t('business_field_client'), account: serviceOrder.client },
          ]}
        />
        {contract ? (
          <BusinessDetailSection
            title={t('business_section_linked')}
            rows={[
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
            ]}
          />
        ) : null}
        <LedgerTechnicalDetails
          ids={[
            {
              label: t('business_field_service_order'),
              id: serviceOrder.service_order_id,
            },
            {
              label: t('business_field_transaction_id'),
              id: serviceOrder.transaction_id,
            },
          ]}
          createdAt={serviceOrder.created_at}
        />
      </div>
      <BusinessConfirmDialog
        open={confirmOpen}
        title={t('business_service_order_cancel_confirm_title')}
        description={t('business_service_order_cancel_confirm_body')}
        confirmLabel={t('business_cancel_service_order')}
        destructive
        busy={isBusy}
        error={error}
        onConfirm={() => void onCancel()}
        onClose={() => setConfirmOpen(false)}
      />
    </BusinessPageShell>
  );
}
