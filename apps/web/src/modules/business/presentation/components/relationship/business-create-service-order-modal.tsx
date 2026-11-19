'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { contractDisplayLabel } from '../../../domain/contract-label';
import type { LedgerContractRow } from '../../../domain/ledger.types';
import { compactServiceOrderDetails } from '../../../domain/service-order-create';
import { emptyValueFromSchema } from '../../../domain/service-order-schema';
import { BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { ObjectBuilder } from '../object-builder';

export type BusinessCreateServiceOrderModalProps = {
  open: boolean;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  contracts: LedgerContractRow[];
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (input: {
    contractId: string;
    details?: Record<string, unknown>;
  }) => Promise<boolean>;
};

export function BusinessCreateServiceOrderModal({
  open,
  onClose,
  isBusy,
  error,
  contracts,
  onSubmit,
}: BusinessCreateServiceOrderModalProps) {
  const { t } = useI18n();
  const [contractId, setContractId] = useState('');
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [detailsValid, setDetailsValid] = useState(true);
  const [detailsBuilderKey, setDetailsBuilderKey] = useState(0);

  function applyContractPrefill(nextContractId: string) {
    const selected = contracts.find((c) => c.contract_id === nextContractId);
    const schema = selected?.service_order_schema;
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
      setDetails(emptyValueFromSchema(schema));
    } else {
      setDetails({});
    }
    setDetailsValid(true);
    setDetailsBuilderKey((key) => key + 1);
  }

  useEffect(() => {
    if (open) {
      const initialId = contracts[0]?.contract_id ?? '';
      setContractId(initialId);
      if (initialId) {
        applyContractPrefill(initialId);
      } else {
        setDetails({});
        setDetailsValid(true);
        setDetailsBuilderKey((key) => key + 1);
      }
    }
  }, [open, contracts]);

  const selectedContract = contracts.find((c) => c.contract_id === contractId);
  const hasSchemaPrefill =
    selectedContract?.service_order_schema !== null &&
    selectedContract?.service_order_schema !== undefined &&
    Object.keys(selectedContract.service_order_schema).length > 0;

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_create_service_order')}
      busy={isBusy}
      error={error}
      submitLabel={t('business_create_service_order_submit')}
      canSubmit={
        contracts.length > 0 && contractId.trim().length > 0 && detailsValid
      }
      onSubmit={() =>
        onSubmit({ contractId, details: compactServiceOrderDetails(details) })
      }
    >
      {contracts.length === 0 ? (
        <p className="text-body-sm text-error" role="alert">
          {t('business_service_order_contract_required_missing')}
        </p>
      ) : (
        <BusinessField
          label={t('business_field_contract')}
          hint={
            hasSchemaPrefill
              ? t('business_service_order_schema_prefill_hint')
              : undefined
          }
        >
          <select
            value={contractId}
            onChange={(e) => {
              const nextId = e.target.value;
              setContractId(nextId);
              applyContractPrefill(nextId);
            }}
            className={BUSINESS_FIELD_CLASS}
          >
            {contracts.map((c) => (
              <option key={c.contract_id} value={c.contract_id}>
                {contractDisplayLabel(c)}
              </option>
            ))}
          </select>
        </BusinessField>
      )}
      <ObjectBuilder
        key={detailsBuilderKey}
        value={details}
        label={t('business_service_order_details_label')}
        disabled={isBusy}
        onChange={(next, valid) => {
          setDetails(next);
          setDetailsValid(valid);
        }}
      />
    </BusinessFormModal>
  );
}
