'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { priceRange } from '../../domain/price-chart-scale';
import { formatRatio, formatSignedPercent, formatUsdPrice } from '../../domain/waiv-format';
import {
  WAIV_CHART_DEFAULT_PERIOD,
  WAIV_CHART_PERIODS,
  type WaivChart,
  type WaivChartPeriod,
} from '../../domain/waiv-token.types';
import { fetchWaivChartClient } from '../../infrastructure/clients/waiv-token.browser.client';
import { PriceAreaChart } from '../charts/price-area-chart';
import { PRICE_CHART_HEIGHT } from '../charts/price-chart.constants';

type WaivPriceCardProps = {
  /** Default-period chart from the server, or null when it failed. */
  initialChart: WaivChart | null;
};

type LoadState = 'idle' | 'loading' | 'error';

function ChangeBadge({ value, locale }: { value: number; locale: string }) {
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-muted';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '';
  return (
    <span className={`inline-flex items-center gap-1 text-body font-weight-strong tabular-nums ${tone}`}>
      {arrow ? <span aria-hidden>{arrow}</span> : null}
      {formatSignedPercent(value, locale)}
    </span>
  );
}

export function WaivPriceCard({ initialChart }: WaivPriceCardProps) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<WaivChartPeriod>(WAIV_CHART_DEFAULT_PERIOD);
  const [chart, setChart] = useState<WaivChart | null>(initialChart);
  const [loadState, setLoadState] = useState<LoadState>(initialChart ? 'idle' : 'error');
  const cacheRef = useRef(new Map<WaivChartPeriod, WaivChart>());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialChart) {
      cacheRef.current.set(initialChart.period, initialChart);
    }
  }, [initialChart]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const load = useCallback(async (next: WaivChartPeriod) => {
    abortRef.current?.abort();
    const cached = cacheRef.current.get(next);
    if (cached) {
      setChart(cached);
      setLoadState('idle');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState('loading');
    const result = await fetchWaivChartClient(next, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    if (!result.ok) {
      setLoadState('error');
      return;
    }
    cacheRef.current.set(next, result.data);
    setChart(result.data);
    setLoadState('idle');
  }, []);

  const selectPeriod = (next: WaivChartPeriod) => {
    setPeriod(next);
    void load(next);
  };

  const shown = chart?.period === period || loadState === 'loading' ? chart : null;
  const latest = chart?.latest ?? null;
  const range = shown && shown.points.length > 1 ? priceRange(shown.points) : null;

  return (
    <section
      aria-labelledby="waiv-price-title"
      className="min-w-0 rounded-card border border-border bg-surface p-card-padding shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="waiv-price-title" className="text-body font-weight-strong text-muted">
            {t('waiv_page_price_title')}
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-display font-weight-display text-heading">
              {latest ? formatUsdPrice(latest.usd, locale) : '—'}
            </span>
            {shown ? <ChangeBadge value={shown.changeUsdPercent} locale={locale} /> : null}
          </div>
          {latest && latest.hive > 0 ? (
            <div className="text-body-sm text-muted tabular-nums">
              {formatRatio(latest.hive, locale)} HIVE
            </div>
          ) : null}
        </div>

        {range ? (
          <dl className="flex gap-6 text-body-sm">
            <div>
              <dt className="text-muted">{t('waiv_page_price_low')}</dt>
              <dd className="font-weight-strong text-fg tabular-nums">
                {formatUsdPrice(range.low, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t('waiv_page_price_high')}</dt>
              <dd className="font-weight-strong text-fg tabular-nums">
                {formatUsdPrice(range.high, locale)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div
        role="group"
        aria-label={t('waiv_page_range_aria')}
        className="mt-4 flex flex-wrap gap-1"
      >
        {WAIV_CHART_PERIODS.map((option) => {
          const selected = option === period;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => selectPeriod(option)}
              className={`rounded-pill px-3 py-1 text-body-sm font-weight-strong uppercase transition-colors ${
                selected ? 'bg-accent text-accent-fg' : 'text-fg-tertiary hover:bg-surface-control hover:text-fg'
              }`}
            >
              {option === 'all' ? t('all') : option}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-w-0">
        {loadState === 'error' && !shown ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border text-body-sm text-error"
            style={{ height: PRICE_CHART_HEIGHT }}
          >
            {t('waiv_page_chart_error')}
            <button
              type="button"
              onClick={() => void load(period)}
              className="rounded-btn border border-border px-3 py-1 text-body-sm text-fg hover:bg-surface-control"
            >
              {t('waiv_page_retry')}
            </button>
          </div>
        ) : (
          <PriceAreaChart
            points={shown?.points ?? []}
            period={shown?.period ?? period}
            pending={loadState === 'loading'}
            ariaLabel={t('waiv_page_chart_aria')}
            emptyLabel={t('waiv_page_chart_empty')}
          />
        )}
      </div>
    </section>
  );
}
