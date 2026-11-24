'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { BUSINESS_CALLOUT_CLASS, BUSINESS_FIELD_CLASS } from '../../ui/classes';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { ObjectBuilder } from '../object-builder';
import {
  AccountPairSwapRow,
  parsePositiveUsdAmount,
} from './relationship-modal-fields';

export type BusinessDeclarePaymentModalProps = {
  open: boolean;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  viewer: string;
  payer: string;
  receiver: string;
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (
    amountUsd: string,
    parties: { payer: string; receiver: string },
    ref?: Record<string, unknown>,
  ) => Promise<boolean>;
};

export function BusinessDeclarePaymentModal({
  open,
  onClose,
  isBusy,
  error,
  viewer,
  payer,
  receiver,
  onSubmit,
}: BusinessDeclarePaymentModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState<Record<string, unknown>>({});
  const [refValid, setRefValid] = useState(true);
  const [refBuilderKey, setRefBuilderKey] = useState(0);
  const [parties, setParties] = useState({ payer, receiver });

  useEffect(() => {
    if (open) {
      setAmount('');
      setParties({ payer, receiver });
      setRef({});
      setRefValid(true);
      setRefBuilderKey((key) => key + 1);
    }
  }, [open, payer, receiver]);

  const isReceiverConfirm = parties.receiver === viewer;

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={t('business_modal_record_payment_title')}
      busy={isBusy}
      error={error}
      submitLabel={
        isReceiverConfirm
          ? t('business_confirm_received_payment')
          : t('business_record_payment')
      }
      canSubmit={parsePositiveUsdAmount(amount) && refValid}
      onSubmit={() =>
        onSubmit(amount, parties, Object.keys(ref).length > 0 ? ref : undefined)
      }
    >
      <AccountPairSwapRow
        leftLabel={t('business_field_payer')}
        rightLabel={t('business_field_receiver')}
        leftValue={`@${parties.payer}`}
        rightValue={`@${parties.receiver}`}
        swapAriaLabel={t('business_payment_swap_payer_receiver')}
        disabled={isBusy}
        onSwap={() =>
          setParties((current) => ({
            payer: current.receiver,
            receiver: current.payer,
          }))
        }
      />
      {isReceiverConfirm ? (
        <p className={BUSINESS_CALLOUT_CLASS}>
          {t('business_payment_receiver_confirm_warning', {
            account: `@${parties.payer}`,
          })}
        </p>
      ) : null}
      <BusinessField label={t('business_field_amount_usd')}>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={BUSINESS_FIELD_CLASS}
        />
      </BusinessField>
      <ObjectBuilder
        key={refBuilderKey}
        value={{}}
        label={t('business_payment_ref_label')}
        disabled={isBusy}
        onChange={(next, valid) => {
          setRef(next);
          setRefValid(valid);
        }}
      />
    </BusinessFormModal>
  );
}
