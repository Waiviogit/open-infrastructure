import { isHiveAccountName } from '@opden-data-layer/common';

import { normalizeHiveAccountInput } from './invoice-issue';
import type { PairBalanceView } from './ledger.types';
import { accountNetUsd } from './pair-balance';

/** Query keys of the pay-on-behalf page: `for` = debtor, `to` = receiver. */
export const PAY_ON_BEHALF_QUERY = { debtor: 'for', receiver: 'to' } as const;

export type PayOnBehalfParties = {
  debtor: string;
  receiver: string;
};

export type PayOnBehalfPartiesError =
  | 'missing_accounts'
  | 'invalid_account'
  | 'debtor_is_receiver'
  | 'viewer_is_receiver';

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? normalizeHiveAccountInput(raw) : '';
}

export function parsePayOnBehalfParams(
  searchParams: Record<string, string | string[] | undefined>,
): PayOnBehalfParties {
  return {
    debtor: firstParam(searchParams[PAY_ON_BEHALF_QUERY.debtor]),
    receiver: firstParam(searchParams[PAY_ON_BEHALF_QUERY.receiver]),
  };
}

/** Mirrors the indexer rules so the page does not broadcast payments that would be skipped. */
export function validatePayOnBehalfParties(
  parties: PayOnBehalfParties,
  viewer: string,
): PayOnBehalfPartiesError | null {
  if (parties.debtor === '' || parties.receiver === '') {
    return 'missing_accounts';
  }
  if (!isHiveAccountName(parties.debtor) || !isHiveAccountName(parties.receiver)) {
    return 'invalid_account';
  }
  if (parties.debtor === parties.receiver) {
    return 'debtor_is_receiver';
  }
  if (normalizeHiveAccountInput(viewer) === parties.receiver) {
    return 'viewer_is_receiver';
  }
  return null;
}

export function buildPayOnBehalfHref(parties: PayOnBehalfParties): string {
  const q = new URLSearchParams({
    [PAY_ON_BEHALF_QUERY.debtor]: parties.debtor,
    [PAY_ON_BEHALF_QUERY.receiver]: parties.receiver,
  });
  return `/business/pay?${q.toString()}`;
}

function isBalanceOfParties(
  balance: Pick<PairBalanceView, 'accountA' | 'accountB'>,
  parties: PayOnBehalfParties,
): boolean {
  const { accountA, accountB } = balance;
  return (
    (accountA === parties.debtor && accountB === parties.receiver) ||
    (accountA === parties.receiver && accountB === parties.debtor)
  );
}

/**
 * Confirmed net USD the debtor owes the receiver — the same figure the relationship page
 * shows; 0 when the pair is settled, the debt runs the other way, or the pair does not match.
 */
export function confirmedDebtUsd(
  balance: Pick<PairBalanceView, 'accountA' | 'accountB' | 'confirmed'>,
  parties: PayOnBehalfParties,
): number {
  if (!isBalanceOfParties(balance, parties)) {
    return 0;
  }
  const owedToReceiver = accountNetUsd(
    parties.receiver,
    balance.accountA,
    balance.accountB,
    balance.confirmed.netUsd,
  );
  return owedToReceiver > 0 ? owedToReceiver : 0;
}
