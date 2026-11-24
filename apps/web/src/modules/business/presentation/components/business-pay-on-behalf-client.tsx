'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';

import {
  buildDeclarePaymentOnBehalfOp,
  buildPayOnBehalfWaivTransferOp,
} from '../../application/build-obl-ops';
import { normalizeHiveAccountInput } from '../../domain/invoice-issue';
import type { PairBalanceView } from '../../domain/ledger.types';
import { newOblPaymentDeclareId } from '../../domain/obl-ids';
import {
  confirmedDebtUsd,
  type PayOnBehalfParties,
  validatePayOnBehalfParties,
} from '../../domain/pay-on-behalf';
import { formatUsd } from '../../domain/usd-format';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { parsePositiveUsdAmount } from './relationship/relationship-modal-fields';
import { StateBadge } from './state-badge';
import { BusinessButton } from '../ui/business-button';
import { BusinessField } from '../ui/business-field';
import { BusinessActionError } from '../ui/business-states';
import {
  BUSINESS_CALLOUT_CLASS,
  BUSINESS_FIELD_CLASS,
  businessCardClass,
} from '../ui/classes';

const CONVERT_USD_TO_WAIV_PATH = '/api/business/convert-usd-to-waiv';

export type BusinessPayOnBehalfClientProps = {
  username: string;
  initialParties: PayOnBehalfParties;
  /** Balance of the initial pair, when it was valid on load. */
  initialBalance: PairBalanceView | null;
};

async function fetchAmountWaiv(amountUsd: string): Promise<number | null> {
  const q = new URLSearchParams({ amountUsd });
  try {
    const res = await fetch(`${CONVERT_USD_TO_WAIV_PATH}?${q.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { amountWaiv?: number | null };
    return typeof body.amountWaiv === 'number' && body.amountWaiv > 0
      ? body.amountWaiv
      : null;
  } catch {
    return null;
  }
}

export function BusinessPayOnBehalfClient({
  username,
  initialParties,
  initialBalance,
}: BusinessPayOnBehalfClientProps) {
  const { t } = useI18n();
  const oblCustomJsonId = useOblCustomJsonId();
  const { broadcast, isBusy, phase, error, setError } =
    useOblBroadcast(username);
  const [debtorInput, setDebtorInput] = useState(initialParties.debtor);
  const [receiverInput, setReceiverInput] = useState(initialParties.receiver);
  const [amount, setAmount] = useState('');
  const [sent, setSent] = useState(false);

  const parties: PayOnBehalfParties = useMemo(
    () => ({
      debtor: normalizeHiveAccountInput(debtorInput),
      receiver: normalizeHiveAccountInput(receiverInput),
    }),
    [debtorInput, receiverInput],
  );
  const partiesError = validatePayOnBehalfParties(parties, username);
  const isInitialPair =
    parties.debtor === initialParties.debtor &&
    parties.receiver === initialParties.receiver;
  const debtUsd =
    initialBalance && isInitialPair
      ? confirmedDebtUsd(initialBalance, parties)
      : null;
  const canSubmit =
    !isBusy && partiesError === null && parsePositiveUsdAmount(amount);

  const partyValues = {
    debtor: `@${parties.debtor}`,
    receiver: `@${parties.receiver}`,
    account: `@${parties.debtor}`,
  };

  async function payWithWaiv() {
    setSent(false);
    const amountWaiv = await fetchAmountWaiv(amount);
    if (amountWaiv === null) {
      setError(t('business_pay_on_behalf_convert_failed'));
      return;
    }
    const trxId = await broadcast([
      buildPayOnBehalfWaivTransferOp({
        paidBy: username,
        debtor: parties.debtor,
        receiver: parties.receiver,
        amountWaiv,
      }),
    ]);
    setSent(trxId !== null);
  }

  async function declareOffchain() {
    setSent(false);
    const trxId = await broadcast([
      buildDeclarePaymentOnBehalfOp({
        oblCustomJsonId,
        paymentId: newOblPaymentDeclareId(),
        payer: parties.debtor,
        receiver: parties.receiver,
        paidBy: username,
        amountUsd: amount,
      }),
    ]);
    setSent(trxId !== null);
  }

  const [busyAction, setBusyAction] = useState<'waiv' | 'offchain' | null>(
    null,
  );

  return (
    <BusinessPageShell
      variant="entity"
      title={t('business_pay_on_behalf_title')}
      subtitle={t('business_pay_on_behalf_subtitle')}
    >
      <div
        className={businessCardClass({
          className: 'flex max-w-container-content flex-col gap-4',
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <BusinessField label={t('business_pay_on_behalf_field_debtor')}>
            <input
              type="text"
              value={debtorInput}
              onChange={(e) => setDebtorInput(e.target.value)}
              disabled={isBusy}
              autoCapitalize="none"
              spellCheck={false}
              className={BUSINESS_FIELD_CLASS}
            />
          </BusinessField>
          <BusinessField label={t('business_pay_on_behalf_field_receiver')}>
            <input
              type="text"
              value={receiverInput}
              onChange={(e) => setReceiverInput(e.target.value)}
              disabled={isBusy}
              autoCapitalize="none"
              spellCheck={false}
              className={BUSINESS_FIELD_CLASS}
            />
          </BusinessField>
        </div>
        <BusinessField label={t('business_field_amount_usd')}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className={BUSINESS_FIELD_CLASS}
          />
        </BusinessField>

        {partiesError ? (
          <p
            className={`text-body-sm ${partiesError === 'missing_accounts' ? 'text-fg-secondary' : 'text-error'}`}
            role={partiesError === 'missing_accounts' ? undefined : 'alert'}
          >
            {t(`business_pay_on_behalf_error_${partiesError}`)}
          </p>
        ) : (
          <div className={`${BUSINESS_CALLOUT_CLASS} flex flex-col gap-1`}>
            {parties.debtor !== normalizeHiveAccountInput(username) ? (
              <p>{t('business_pay_on_behalf_you_pay_for', partyValues)}</p>
            ) : null}
            {debtUsd !== null && debtUsd > 0 ? (
              <p>
                {t('business_pay_on_behalf_debt_hint', {
                  ...partyValues,
                  amount: formatUsd(debtUsd),
                })}
              </p>
            ) : null}
            {debtUsd === 0 ? (
              <p className="text-error">
                {t('business_pay_on_behalf_no_debt_warning', partyValues)}
              </p>
            ) : null}
          </div>
        )}

        <BusinessActionError message={error} />
        {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
        {sent ? (
          <p className="text-body-sm text-fg" role="status">
            {t('business_pay_on_behalf_sent', partyValues)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <BusinessButton
            variant="primary"
            busy={isBusy && busyAction === 'waiv'}
            disabled={!canSubmit}
            onClick={() => {
              setBusyAction('waiv');
              void payWithWaiv();
            }}
          >
            {t('business_pay_on_behalf_pay_waiv')}
          </BusinessButton>
          <BusinessButton
            busy={isBusy && busyAction === 'offchain'}
            disabled={!canSubmit}
            onClick={() => {
              setBusyAction('offchain');
              void declareOffchain();
            }}
          >
            {t('business_pay_on_behalf_declare_offchain')}
          </BusinessButton>
        </div>
        <p className="text-caption text-fg-secondary">
          {t('business_pay_on_behalf_declare_hint', partyValues)}
        </p>
      </div>
    </BusinessPageShell>
  );
}
