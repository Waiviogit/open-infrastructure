'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { PairBalanceView } from '../../domain/ledger.types';
import { accountNetUsd } from '../../domain/pair-balance';
import { formatUsd } from '../../domain/usd-format';
import { businessCardClass } from '../ui/classes';
import {
  BALANCE_DIRECTION_TEXT_CLASS,
  balanceDirection,
  directionalUsdText,
} from './directional-usd';

export type BalanceCardsProps = {
  viewer: string;
  counterparty: string;
  balance: PairBalanceView;
};

const SECONDARY_BUCKETS = ['pending', 'disputed'] as const;

/**
 * Relationship balance: the confirmed position as the headline ("@alice owes you $2,101.00"),
 * pending and disputed buckets as a compact second row. Same direction wording everywhere.
 */
export function BalanceCards({
  viewer,
  counterparty,
  balance,
}: BalanceCardsProps) {
  const { t } = useI18n();
  const net = (bucket: 'confirmed' | 'pending' | 'disputed') =>
    accountNetUsd(
      viewer,
      balance.accountA,
      balance.accountB,
      balance[bucket].netUsd,
    );
  const confirmedNet = net('confirmed');

  return (
    <section
      className={businessCardClass()}
      aria-labelledby="relationship-balance-title"
    >
      <h2
        id="relationship-balance-title"
        className="text-caption font-weight-label text-fg-secondary"
      >
        {t('business_balance_confirmed')}
      </h2>
      <p
        className={`mt-1 text-body-lg font-weight-strong tabular-nums ${BALANCE_DIRECTION_TEXT_CLASS[balanceDirection(confirmedNet)]}`}
      >
        {directionalUsdText(confirmedNet, counterparty, t)}
      </p>
      <p className="mt-0.5 text-caption text-fg-secondary">
        {t('business_balance_confirmed_hint')}
      </p>
      <dl className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        {SECONDARY_BUCKETS.map((bucket) => {
          const value = net(bucket);
          return (
            <div key={bucket} className="min-w-0">
              <dt className="text-caption text-fg-secondary">
                {t(`business_balance_${bucket}`)}
              </dt>
              <dd
                className={`mt-0.5 text-body-sm font-weight-label tabular-nums ${BALANCE_DIRECTION_TEXT_CLASS[balanceDirection(value)]}`}
              >
                {directionalUsdText(value, counterparty, t, formatUsd(0))}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
