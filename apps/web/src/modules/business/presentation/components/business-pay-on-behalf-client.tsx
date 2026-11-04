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
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { formatDisplayUsd } from './directional-usd';
import { parsePositiveUsdAmount } from './relationship/relationship-modal-fields';
import { StateBadge } from './state-badge';

const CONVERT_USD_TO_WAIV_PATH = '/api/business/convert-usd-to-waiv';

export type BusinessPayOnBehalfClientProps = {
  username: string;
  initialParties: PayOnBehalfParties;
  /** Balance of the initial pair, when it was valid on load. */
  initialBalance: PairBalanceView | null;
};

async function fetchAmountWaiv(amountUsd: string): Promise<number | null> {
  const q = new URLSearchParams({ amountUsd });
  const res = await fetch(`${CONVERT_USD_TO_WAIV_PATH}?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as { amountWaiv?: number | null };
  return typeof body.amountWaiv === 'number' && body.amountWaiv > 0 ? body.amountWaiv : null;
}

export function BusinessPayOnBehalfClient({
  username,
  initialParties,
  initialBalance,
}: BusinessPayOnBehalfClientProps) {
  const { t } = useI18n();
  const oblCustomJsonId = useOblCustomJsonId();
  const { broadcast, isBusy, phase, error, setError } = useOblBroadcast(username);
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
    parties.debtor === initialParties.debtor && parties.receiver === initialParties.receiver;
  const debtUsd = initialBalance && isInitialPair ? confirmedDebtUsd(initialBalance, parties) : null;
  const canSubmit = !isBusy && partiesError === null && parsePositiveUsdAmount(amount);

  function fillAccount(template: string): string {
    return template
      .replace('{debtor}', `@${parties.debtor}`)
      .replace('{receiver}', `@${parties.receiver}`)
      .replace('{account}', `@${parties.debtor}`);
  }

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

  return (
    <BusinessPageShell
      activeNav="relationships"
      title={t('business_pay_on_behalf_title')}
      subtitle={t('business_pay_on_behalf_subtitle')}
    >
      <div className="flex max-w-container-content flex-col gap-4">
        <label className="flex flex-col gap-1 text-body-sm">
          {t('business_pay_on_behalf_field_debtor')}
          <input
            type="text"
            value={debtorInput}
            onChange={(e) => setDebtorInput(e.target.value)}
            disabled={isBusy}
            className="rounded-btn border border-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-body-sm">
          {t('business_pay_on_behalf_field_receiver')}
          <input
            type="text"
            value={receiverInput}
            onChange={(e) => setReceiverInput(e.target.value)}
            disabled={isBusy}
            className="rounded-btn border border-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-body-sm">
          {t('business_field_amount_usd')}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className="rounded-btn border border-border px-3 py-2"
          />
        </label>

        {partiesError ? (
          <p className="text-body-sm text-error" role="alert">
            {t(`business_pay_on_behalf_error_${partiesError}`)}
          </p>
        ) : (
          <aside className="rounded-card border border-border bg-surface-alt p-card-padding text-body-sm text-fg-secondary">
            {parties.debtor !== normalizeHiveAccountInput(username) ? (
              <p>{fillAccount(t('business_pay_on_behalf_you_pay_for'))}</p>
            ) : null}
            {debtUsd !== null && debtUsd > 0 ? (
              <p>
                {fillAccount(t('business_pay_on_behalf_debt_hint')).replace(
                  '{amount}',
                  formatDisplayUsd(debtUsd),
                )}
              </p>
            ) : null}
            {debtUsd === 0 ? (
              <p role="alert">{fillAccount(t('business_pay_on_behalf_no_debt_warning'))}</p>
            ) : null}
          </aside>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void payWithWaiv()}
            className="rounded-btn bg-accent px-4 py-2 text-body-sm font-weight-label text-accent-fg disabled:opacity-50"
          >
            {t('business_pay_on_behalf_pay_waiv')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void declareOffchain()}
            className="rounded-btn border border-border px-4 py-2 text-body-sm disabled:opacity-50"
          >
            {t('business_pay_on_behalf_declare_offchain')}
          </button>
        </div>
        <p className="text-caption text-fg-tertiary">
          {fillAccount(t('business_pay_on_behalf_declare_hint'))}
        </p>

        {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
        {error ? <p className="text-body-sm text-error">{error}</p> : null}
        {sent ? (
          <p className="text-body-sm text-fg-secondary" role="status">
            {fillAccount(t('business_pay_on_behalf_sent'))}
          </p>
        ) : null}
      </div>
    </BusinessPageShell>
  );
}
