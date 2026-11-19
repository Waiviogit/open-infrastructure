'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { LedgerPaymentRow } from '../../../domain/ledger.types';
import { formatUsd } from '../../../domain/usd-format';
import { BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { BusinessDisclosure } from '../business-disclosure';
import {
  RelationshipReadonlyField,
  parsePositiveUsdAmount,
} from './relationship-modal-fields';

export type BusinessConfirmPaymentModalProps = {
  open: boolean;
  payment: LedgerPaymentRow | null;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (payment: LedgerPaymentRow, amountUsd: string) => Promise<boolean>;
};

export function BusinessConfirmPaymentModal({
  open,
  payment,
  onClose,
  isBusy,
  error,
  onSubmit,
}: BusinessConfirmPaymentModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount_usd);
    }
  }, [payment]);

  if (!payment) {
    return null;
  }

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_modal_confirm_payment_title')}
      busy={isBusy}
      error={error}
      submitLabel={t('business_confirm_received_payment')}
      canSubmit={parsePositiveUsdAmount(amount)}
      onSubmit={() => onSubmit(payment, amount)}
    >
      <BusinessDisclosure variant="payment_partial_confirm" />
      <div className="grid gap-3 sm:grid-cols-2">
        <RelationshipReadonlyField
          label={t('business_field_payer')}
          value={`@${payment.payer}`}
        />
        <RelationshipReadonlyField
          label={t('business_field_receiver')}
          value={`@${payment.receiver}`}
        />
      </div>
      <RelationshipReadonlyField
        label={t('business_field_declared_amount')}
        value={formatUsd(payment.amount_usd)}
      />
      <BusinessField label={t('business_field_confirm_amount')}>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={BUSINESS_FIELD_CLASS}
        />
      </BusinessField>
    </BusinessFormModal>
  );
}
