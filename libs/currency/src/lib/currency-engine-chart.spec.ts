import type { HiveEngineRatesRow } from '@opden-data-layer/odl-db-types';

import {
  ENGINE_CHART_WINDOWS,
  engineChartPointFromRow,
  keepLatestPerBucket,
  mergeEngineChartHead,
  resolveEngineChartWindow,
  type EngineChartPoint,
} from './currency-engine-chart';

function point(timestamp: string, usd: number): EngineChartPoint {
  return {
    dateString: timestamp.slice(0, 10),
    timestamp,
    rates: { HIVE: usd * 10, USD: usd },
  };
}

function row(partial: Partial<HiveEngineRatesRow>): HiveEngineRatesRow {
  return {
    id: BigInt(1) as never,
    base: 'WAIV',
    is_daily: false,
    date: '2026-11-27',
    rate_hive: 0.18,
    rate_usd: 0.0066,
    change_24h_hive: null,
    change_24h_usd: null,
    created_at: new Date('2026-11-27T10:05:12.000Z'),
    ...partial,
  } as HiveEngineRatesRow;
}

describe('resolveEngineChartWindow', () => {
  it('maps 1d and 7d to intraday windows', () => {
    expect(resolveEngineChartWindow('1d')).toEqual(ENGINE_CHART_WINDOWS['1d']);
    expect(resolveEngineChartWindow(' 7D ')).toMatchObject({ kind: 'intraday', days: 7 });
  });

  it('falls back to 1m for unknown periods', () => {
    expect(resolveEngineChartWindow('30d')).toEqual(ENGINE_CHART_WINDOWS['1m']);
    expect(resolveEngineChartWindow('constructor')).toEqual(ENGINE_CHART_WINDOWS['1m']);
  });
});

describe('engineChartPointFromRow', () => {
  it('places ordinary rows at created_at', () => {
    expect(engineChartPointFromRow(row({}))).toEqual({
      dateString: '2026-11-27',
      timestamp: '2026-11-27T10:05:12.000Z',
      rates: { HIVE: 0.18, USD: 0.0066 },
    });
  });

  it('places daily rows at midnight UTC of their date', () => {
    const daily = engineChartPointFromRow(row({ is_daily: true, date: '2026-11-20' }));
    expect(daily.timestamp).toBe('2026-11-20T00:00:00.000Z');
  });

  it('parses NUMERIC strings', () => {
    const parsed = engineChartPointFromRow(
      row({ rate_hive: '0.181' as never, rate_usd: '0.0067' as never }),
    );
    expect(parsed.rates).toEqual({ HIVE: 0.181, USD: 0.0067 });
  });
});

describe('keepLatestPerBucket', () => {
  it('keeps the newest sample of each 30 min slot', () => {
    const result = keepLatestPerBucket(
      [
        point('2026-11-27T10:00:00.000Z', 1),
        point('2026-11-27T10:05:00.000Z', 2),
        point('2026-11-27T10:29:59.000Z', 3),
        point('2026-11-27T10:30:00.000Z', 4),
        point('2026-11-27T11:10:00.000Z', 5),
      ],
      30,
    );
    expect(result.map((each) => each.rates.USD)).toEqual([3, 4, 5]);
  });

  it('returns an empty list for no samples', () => {
    expect(keepLatestPerBucket([], 5)).toEqual([]);
  });
});

describe('mergeEngineChartHead', () => {
  it('intraday: keeps every older sample, newest first, head on top', () => {
    const head = point('2026-11-27T12:00:00.000Z', 9);
    const series = [
      point('2026-11-27T10:00:00.000Z', 1),
      point('2026-11-27T11:00:00.000Z', 2),
      point('2026-11-27T12:00:00.000Z', 9),
    ];
    const merged = mergeEngineChartHead(head, series, ENGINE_CHART_WINDOWS['1d']);
    expect(merged.map((each) => each.rates.USD)).toEqual([9, 2, 1]);
  });

  it('daily: the head replaces its own day and duplicate days collapse', () => {
    const head = point('2026-11-27T12:00:00.000Z', 9);
    const series = [
      point('2026-11-25T00:00:00.000Z', 1),
      point('2026-11-26T00:00:00.000Z', 2),
      point('2026-11-26T00:00:00.000Z', 3),
      point('2026-11-27T00:00:00.000Z', 4),
    ];
    const merged = mergeEngineChartHead(head, series, ENGINE_CHART_WINDOWS['1m']);
    expect(merged.map((each) => each.dateString)).toEqual([
      '2026-11-27',
      '2026-11-26',
      '2026-11-25',
    ]);
    expect(merged[0].rates.USD).toBe(9);
  });
});
