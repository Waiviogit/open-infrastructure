'use client';

import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import {
  contractDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../../domain/contract-label';
import type {
  LedgerContractRow,
  LedgerServiceOrderRow,
} from '../../../domain/ledger.types';
import { BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { ObjectBuilder } from '../object-builder';

export type BusinessCreateReportModalProps = {
  open: boolean;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  contracts: LedgerContractRow[];
  serviceOrders: LedgerServiceOrderRow[];
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (input: {
    contractId?: string;
    serviceOrderId?: string;
    details?: Record<string, unknown>;
  }) => Promise<boolean>;
};

export function BusinessCreateReportModal({
  open,
  onClose,
  isBusy,
  error,
  contracts,
  serviceOrders,
  onSubmit,
}: BusinessCreateReportModalProps) {
  const { t } = useI18n();
  const [contractId, setContractId] = useState('');
  const [serviceOrderId, setServiceOrderId] = useState('');
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [detailsValid, setDetailsValid] = useState(true);
  const [detailsBuilderKey, setDetailsBuilderKey] = useState(0);

  useEffect(() => {
    if (open) {
      setContractId('');
      setServiceOrderId('');
      setDetails({});
      setDetailsValid(true);
      setDetailsBuilderKey((key) => key + 1);
    }
  }, [open, contracts]);

  /** Only active service orders, narrowed to the chosen contract. */
  const linkableServiceOrders = useMemo(
    () =>
      serviceOrders.filter(
        (so) =>
          so.status !== 'cancelled' &&
          (!contractId || so.contract_id === contractId),
      ),
    [serviceOrders, contractId],
  );

  const hasLink = contractId.length > 0 || serviceOrderId.length > 0;

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_create_report')}
      busy={isBusy}
      error={error}
      submitLabel={t('business_create_report_submit')}
      canSubmit={hasLink && detailsValid}
      onSubmit={() =>
        onSubmit({
          contractId: contractId || undefined,
          serviceOrderId: serviceOrderId || undefined,
          details: Object.keys(details).length > 0 ? details : undefined,
        })
      }
    >
      <p className="text-body-sm text-fg">{t('business_report_link_hint')}</p>
      {contracts.length > 0 ? (
        <BusinessField label={t('business_field_contract')}>
          <select
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              setServiceOrderId('');
            }}
            className={BUSINESS_FIELD_CLASS}
          >
            <option value="">{t('business_report_no_contract_option')}</option>
            {contracts.map((c) => (
              <option key={c.contract_id} value={c.contract_id}>
                {contractDisplayLabel(c)}
              </option>
            ))}
          </select>
        </BusinessField>
      ) : null}
      {linkableServiceOrders.length > 0 ? (
        <BusinessField label={t('business_field_service_order')}>
          <select
            value={serviceOrderId}
            onChange={(e) => setServiceOrderId(e.target.value)}
            className={BUSINESS_FIELD_CLASS}
          >
            <option value="">
              {t('business_report_no_service_order_option')}
            </option>
            {linkableServiceOrders.map((so) => (
              <option key={so.service_order_id} value={so.service_order_id}>
                {serviceOrderDisplayLabel(so, contracts)}
              </option>
            ))}
          </select>
        </BusinessField>
      ) : null}
      <ObjectBuilder
        key={detailsBuilderKey}
        value={{}}
        label={t('business_report_details_label')}
        disabled={isBusy}
        onChange={(next, valid) => {
          setDetails(next);
          setDetailsValid(valid);
        }}
      />
    </BusinessFormModal>
  );
}
