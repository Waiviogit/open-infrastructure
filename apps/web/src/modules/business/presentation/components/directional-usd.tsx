'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { DirectionalUsdView } from '../../domain/ledger.types';
import { formatUsd } from '../../domain/usd-format';

function parseUsd(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function directionalAmountsForViewer(
  viewer: string,
  accountA: string,
  accountB: string,
  bucket: DirectionalUsdView,
): { viewerOwes: number; owesViewer: number } {
  const owesAtoB = parseUsd(bucket.owesAtoB);
  const owesBtoA = parseUsd(bucket.owesBtoA);
  if (viewer === accountA) {
    return { viewerOwes: owesAtoB, owesViewer: owesBtoA };
  }
  if (viewer === accountB) {
    return { viewerOwes: owesBtoA, owesViewer: owesAtoB };
  }
  return { viewerOwes: owesAtoB, owesViewer: owesBtoA };
}

/** netUsd = raw owesBtoA − raw owesAtoB; positive means accountB owes accountA. */
export function viewerNetUsd(
  viewer: string,
  accountA: string,
  accountB: string,
  netUsd: string,
): number {
  const net = parseUsd(netUsd);
  if (viewer === accountA) {
    return net;
  }
  if (viewer === accountB) {
    return -net;
  }
  return net;
}

export function shouldShowPendingWhenSettled(
  viewer: string,
  accountA: string,
  accountB: string,
  confirmed: DirectionalUsdView,
  pending: DirectionalUsdView,
): boolean {
  return (
    viewerNetUsd(viewer, accountA, accountB, confirmed.netUsd) === 0 &&
    viewerNetUsd(viewer, accountA, accountB, pending.netUsd) !== 0
  );
}

export function formatPendingBalanceLine(
  viewer: string,
  counterparty: string,
  accountA: string,
  accountB: string,
  pending: DirectionalUsdView,
  t: (key: string) => string,
): string {
  const viewerNet = viewerNetUsd(viewer, accountA, accountB, pending.netUsd);
  if (viewerNet > 0) {
    return t('business_balance_pending_counterparty_owes_you')
      .replace('@account', `@${counterparty}`)
      .replace('$amount', formatUsd(viewerNet));
  }
  if (viewerNet < 0) {
    return t('business_balance_pending_you_owe_counterparty')
      .replace('@account', `@${counterparty}`)
      .replace('$amount', formatUsd(Math.abs(viewerNet)));
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

/** Owed to the viewer reads as positive; settled recedes. Owing stays neutral (not an error). */
export const BALANCE_DIRECTION_TEXT_CLASS: Record<BalanceDirection, string> = {
  owed: 'text-success',
  owing: 'text-heading',
  settled: 'text-fg-secondary',
};

export function directionalUsdText(
  viewerNet: number,
  counterparty: string,
  t: (key: string) => string,
  zeroLabel?: string,
): string {
  const direction = balanceDirection(viewerNet);
  if (direction === 'owed') {
    return t('business_balance_counterparty_owes_you')
      .replace('@account', `@${counterparty}`)
      .replace('$amount', formatUsd(viewerNet));
  }
  if (direction === 'owing') {
    return t('business_balance_you_owe_counterparty')
      .replace('@account', `@${counterparty}`)
      .replace('$amount', formatUsd(Math.abs(viewerNet)));
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
  const viewerNet = viewerNetUsd(viewer, accountA, accountB, bucket.netUsd);
  const direction = balanceDirection(viewerNet);

  return (
    <p
      className={`tabular-nums ${BALANCE_DIRECTION_TEXT_CLASS[direction]} ${className}`}
    >
      {directionalUsdText(viewerNet, counterparty, t, zeroLabel)}
    </p>
  );
}
