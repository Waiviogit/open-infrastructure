'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { InfoIcon } from '@/icons';

import { BUSINESS_CALLOUT_CLASS } from '../ui/classes';

export type BusinessDisclosureVariant =
  | 'ledger_start'
  | 'auto_payments'
  | 'legal_ref_warning'
  | 'immutable_version'
  | 'sign_metadata_hint'
  | 'payment_partial_confirm';

const KEYS: Record<BusinessDisclosureVariant, string> = {
  ledger_start: 'business_disclosure_ledger',
  auto_payments: 'business_disclosure_auto_payments',
  legal_ref_warning: 'business_disclosure_legal_ref',
  immutable_version: 'business_disclosure_immutable',
  sign_metadata_hint: 'business_disclosure_sign_metadata',
  payment_partial_confirm: 'business_disclosure_payment_partial_confirm',
};

export function BusinessDisclosure({
  variant,
}: {
  variant: BusinessDisclosureVariant;
}) {
  const { t } = useI18n();
  return (
    <aside
      className={`${BUSINESS_CALLOUT_CLASS} flex items-start gap-2`}
      role="note"
    >
      <InfoIcon size={16} className="mt-0.5 shrink-0 text-fg-secondary" />
      <span>{t(KEYS[variant])}</span>
    </aside>
  );
}
