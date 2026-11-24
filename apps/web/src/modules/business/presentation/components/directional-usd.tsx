'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { Translate } from '@/i18n/types';

import type { DirectionalUsdView } from '../../domain/ledger.types';
import { accountNetUsd } from '../../domain/pair-balance';
import { formatUsd } from '../../domain/usd-format';

export function shouldShowPendingWhenSettled(
  viewer: string,
  accountA: string,
  accountB: string,
  confirmed: DirectionalUsdView,
  pending: DirectionalUsdView,
): boolean {
  return (
    accountNetUsd(viewer, accountA, accountB, confirmed.netUsd) === 0 &&
    accountNetUsd(viewer, accountA, accountB, pending.netUsd) !== 0
  );
}

export function formatPendingBalanceLine(
  viewer: string,
  counterparty: string,
  accountA: string,
  accountB: string,
  pending: DirectionalUsdView,
  t: Translate,
): string {
  const viewerNet = accountNetUsd(viewer, accountA, accountB, pending.netUsd);
  if (viewerNet > 0) {
    return t('business_balance_pending_counterparty_owes_you', {
      account: counterparty,
      amount: formatUsd(viewerNet),
    });
  }
  if (viewerNet < 0) {
    return t('business_balance_pending_you_owe_counterparty', {
      account: counterparty,
      amount: formatUsd(Math.abs(viewerNet)),
    });
  }
  return '';
}

/** Who owes whom, from the viewer's side: `owed` = the counterparty owes the viewer. */
export type BalanceDirection = 'owed' | 'owing' | 'settled';

export function balanceDirection(viewerNet: number): BalanceDirection {
  if (viewerNet > 0) {
    return 'owed';
  }
  if (viewerNet < 0) {
    return 'owing';
  }
  return 'settled';
}

/** Direction is spelled out in words; settled recedes. Text stays neutral for contrast (WCAG 1.4.3). */
export const BALANCE_DIRECTION_TEXT_CLASS: Record<BalanceDirection, string> = {
  owed: 'text-heading',
  owing: 'text-heading',
  settled: 'text-fg-secondary',
};

export function directionalUsdText(
  viewerNet: number,
  counterparty: string,
  t: Translate,
  zeroLabel?: string,
): string {
  const direction = balanceDirection(viewerNet);
  if (direction === 'owed') {
    return t('business_balance_counterparty_owes_you', {
      account: counterparty,
      amount: formatUsd(viewerNet),
    });
  }
  if (direction === 'owing') {
    return t('business_balance_you_owe_counterparty', {
      account: counterparty,
      amount: formatUsd(Math.abs(viewerNet)),
    });
  }
  return zeroLabel ?? t('business_balance_settled');
}

export type DirectionalUsdProps = {
  viewer: string;
  counterparty: string;
  accountA: string;
  accountB: string;
  bucket: DirectionalUsdView;
  /** Text for a zero bucket (defaults to "Settled"). */
  zeroLabel?: string;
  className?: string;
};

export function DirectionalUsd({
  viewer,
  counterparty,
  accountA,
  accountB,
  bucket,
  zeroLabel,
  className = 'text-body font-weight-strong',
}: DirectionalUsdProps) {
  const { t } = useI18n();
  const viewerNet = accountNetUsd(viewer, accountA, accountB, bucket.netUsd);
  const direction = balanceDirection(viewerNet);

  return (
    <p
      className={`tabular-nums ${BALANCE_DIRECTION_TEXT_CLASS[direction]} ${className}`}
    >
      {directionalUsdText(viewerNet, counterparty, t, zeroLabel)}
    </p>
  );
}
