'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { MessageKey } from '@/i18n/types';

import {
  formatCount,
  formatRate,
  formatTokenAmount,
  formatUsdAmount,
} from '../../domain/waiv-format';
import type { WaivChart, WaivStats } from '../../domain/waiv-token.types';
import { SegmentedBreakdown } from './segmented-breakdown';
import { WaivPriceCard } from './waiv-price-card';

const EMPTY_VALUE = '—';

type StatTile = { labelKey: MessageKey; value: string };

function StatTiles({ tiles }: { tiles: readonly StatTile[] }) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.labelKey}
          className="min-w-0 rounded-card border border-border bg-surface p-card-padding"
        >
          <dt className="text-body-sm text-muted">{t(tile.labelKey)}</dt>
          <dd className="mt-1 truncate text-section font-weight-strong text-fg">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DevelopmentFundCard({ fund }: { fund: WaivStats['developmentFund'] }) {
  const { t, locale } = useI18n();
  const ratio =
    fund.availablePerMonthWaiv > 0
      ? Math.min(1, fund.distributedPerMonthWaiv / fund.availablePerMonthWaiv)
      : 0;
  const rows = [
    {
      labelKey: 'waiv_page_dev_fund_distributed' as const,
      waiv: fund.distributedPerMonthWaiv,
      usd: fund.distributedPerMonthUsd,
    },
    {
      labelKey: 'waiv_page_dev_fund_available' as const,
      waiv: fund.availablePerMonthWaiv,
      usd: fund.availablePerMonthUsd,
    },
  ];

  return (
    <section className="min-w-0 rounded-card border border-border bg-surface p-card-padding">
      <h3 className="text-body font-weight-strong text-fg">{t('waiv_page_dev_fund')}</h3>
      <div
        role="meter"
        aria-label={t('waiv_page_dev_fund_distributed')}
        aria-valuemin={0}
        aria-valuemax={fund.availablePerMonthWaiv}
        aria-valuenow={fund.distributedPerMonthWaiv}
        className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-accent-soft"
      >
        <span className="block h-full rounded-pill bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.labelKey} className="flex min-w-0 items-baseline gap-2 text-body-sm">
            <span className="min-w-0 flex-1 truncate text-fg">{t(row.labelKey)}</span>
            <span className="font-weight-strong text-fg tabular-nums">
              {formatTokenAmount(row.waiv, locale)} WAIV
            </span>
            {row.usd !== null ? (
              <span className="text-muted tabular-nums">{formatUsdAmount(row.usd, locale)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

type WaivStatsViewProps = {
  stats: WaivStats | null;
  chart: WaivChart | null;
};

/** `/waiv`: price chart, headline figures and tokenomics. */
export function WaivStatsView({ stats, chart }: WaivStatsViewProps) {
  const { t, locale } = useI18n();

  const tiles: StatTile[] = stats
    ? [
        {
          labelKey: 'waiv_page_stat_circulation',
          value: formatTokenAmount(stats.supply.circulating, locale),
        },
        {
          labelKey: 'waiv_page_stat_market_cap',
          value: stats.marketCapUsd === null ? EMPTY_VALUE : formatUsdAmount(stats.marketCapUsd, locale),
        },
        { labelKey: 'waiv_page_stat_staked', value: formatTokenAmount(stats.supply.staked, locale) },
        {
          labelKey: 'waiv_page_stat_holders',
          value: stats.accounts.holders === null ? EMPTY_VALUE : formatCount(stats.accounts.holders, locale),
        },
        {
          labelKey: 'waiv_page_stat_monthly_active',
          value:
            stats.accounts.monthlyActive === null
              ? EMPTY_VALUE
              : formatCount(stats.accounts.monthlyActive, locale),
        },
        {
          labelKey: 'waiv_page_stat_inflation',
          value: formatRate(stats.annualInflationPercent, locale),
        },
      ]
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WaivPriceCard initialChart={chart} />

      {stats ? (
        <>
          <StatTiles tiles={tiles} />

          <section aria-labelledby="waiv-tokenomics-title" className="flex min-w-0 flex-col gap-3">
            <h2 id="waiv-tokenomics-title" className="text-section font-weight-strong text-heading">
              {t('waiv_page_tokenomics_title')}
            </h2>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <SegmentedBreakdown
                title={t('waiv_page_staking_title')}
                parts={[
                  {
                    id: 'power',
                    label: t('waiv_page_staking_power'),
                    value: stats.supply.staked,
                    detail: `${formatTokenAmount(stats.supply.staked, locale)} WAIV`,
                  },
                  {
                    id: 'liquid',
                    label: t('waiv_page_staking_liquid'),
                    value: stats.supply.liquid,
                    detail: `${formatTokenAmount(stats.supply.liquid, locale)} WAIV`,
                  },
                ]}
              />
              <SegmentedBreakdown
                title={t('waiv_page_inflation_title')}
                parts={[
                  {
                    id: 'rewards',
                    label: t('waiv_page_rewards_pool'),
                    value: stats.inflationDistribution.rewardsPool,
                  },
                  {
                    id: 'dev-fund',
                    label: t('waiv_page_dev_fund'),
                    value: stats.inflationDistribution.developmentFund,
                  },
                  {
                    id: 'liquidity',
                    label: t('waiv_page_liquidity_providers'),
                    value: stats.inflationDistribution.liquidityProviders,
                  },
                ]}
              />
              <SegmentedBreakdown
                title={t('waiv_page_rewards_pool')}
                parts={[
                  { id: 'authors', label: t('authors'), value: stats.rewardsPool.authors },
                  { id: 'curators', label: t('waiv_page_curators'), value: stats.rewardsPool.curators },
                ]}
              />
              <DevelopmentFundCard fund={stats.developmentFund} />
            </div>
          </section>
        </>
      ) : (
        <p role="alert" className="rounded-card border border-border bg-surface p-card-padding text-body-sm text-error">
          {t('waiv_page_stats_unavailable')}
        </p>
      )}
    </div>
  );
}
