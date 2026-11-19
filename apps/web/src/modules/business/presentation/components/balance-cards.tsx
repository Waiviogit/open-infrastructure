'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { PairBalanceView } from '../../domain/ledger.types';
import { formatUsd } from '../../domain/usd-format';
import { businessCardClass } from '../ui/classes';
import { DirectionalUsd } from './directional-usd';

export type BalanceCardsProps = {
  viewer: string;
  counterparty: string;
  balance: PairBalanceView;
};

const BUCKETS = ['confirmed', 'pending', 'disputed'] as const;

export function BalanceCards({
  viewer,
  counterparty,
  balance,
}: BalanceCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {BUCKETS.map((bucket) => (
        <section key={bucket} className={businessCardClass()}>
          <h2 className="text-caption font-weight-label text-fg-secondary">
            {t(`business_balance_${bucket}`)}
          </h2>
          <DirectionalUsd
            viewer={viewer}
            counterparty={counterparty}
            accountA={balance.accountA}
            accountB={balance.accountB}
            bucket={balance[bucket]}
            zeroLabel={bucket === 'confirmed' ? undefined : formatUsd(0)}
            className="mt-1 text-body font-weight-strong"
          />
          <p className="mt-1 text-caption text-fg-secondary">
            {t(`business_balance_${bucket}_hint`)}
          </p>
        </section>
      ))}
    </div>
  );
}
