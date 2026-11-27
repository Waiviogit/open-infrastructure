import type { HiveEngineRatesRow } from '@opden-data-layer/odl-db-types';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Intraday sample step of `1d` (scheduler writes one ordinary row every ~5 min). */
export const ENGINE_CHART_1D_BUCKET_MINUTES = 5;
/** `7d` keeps one point per 30 min (~336 points instead of ~2000 raw samples). */
export const ENGINE_CHART_7D_BUCKET_MINUTES = 30;

export type EngineChartWindow =
  | { kind: 'intraday'; days: number; bucketMinutes: number }
  | { kind: 'daily'; days: number };

/** `days: 0` on a daily window means the whole history. */
export const ENGINE_CHART_WINDOWS = {
  '1d': { kind: 'intraday', days: 1, bucketMinutes: ENGINE_CHART_1D_BUCKET_MINUTES },
  '7d': { kind: 'intraday', days: 7, bucketMinutes: ENGINE_CHART_7D_BUCKET_MINUTES },
  '1m': { kind: 'daily', days: 31 },
  '3m': { kind: 'daily', days: 93 },
  '6m': { kind: 'daily', days: 186 },
  '1y': { kind: 'daily', days: 372 },
  '2y': { kind: 'daily', days: 744 },
  all: { kind: 'daily', days: 0 },
} as const satisfies Record<string, EngineChartWindow>;

export type EngineChartPeriod = keyof typeof ENGINE_CHART_WINDOWS;

export const ENGINE_CHART_DEFAULT_PERIOD: EngineChartPeriod = '1m';

export type EngineChartRates = { HIVE: number; USD: number };

export type EngineChartPoint = {
  /** UTC day of the sample (`YYYY-MM-DD`); kept for legacy consumers. */
  dateString: string;
  /** ISO instant: sample time for intraday rows, 00:00Z of the day for daily rows. */
  timestamp: string;
  rates: EngineChartRates;
};

function isEngineChartPeriod(key: string): key is EngineChartPeriod {
  return Object.prototype.hasOwnProperty.call(ENGINE_CHART_WINDOWS, key);
}

/** Unknown periods fall back to `1m` (legacy behaviour). */
export function resolveEngineChartWindow(rawPeriod: string): EngineChartWindow {
  const key = rawPeriod.trim().toLowerCase();
  return ENGINE_CHART_WINDOWS[isEngineChartPeriod(key) ? key : ENGINE_CHART_DEFAULT_PERIOD];
}

export function intradayWindowStart(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

function ymdOf(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function isoOf(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

/** Ordinary rows are placed at `created_at`; daily rows at 00:00Z of their `date`. */
export function engineChartPointFromRow(row: HiveEngineRatesRow): EngineChartPoint {
  const dateString = ymdOf(row.date);
  return {
    dateString,
    timestamp: row.is_daily ? `${dateString}T00:00:00.000Z` : isoOf(row.created_at),
    rates: { HIVE: Number(row.rate_hive), USD: Number(row.rate_usd) },
  };
}

/** Keeps the newest point of each `bucketMinutes` slot. Input and output are oldest first. */
export function keepLatestPerBucket(
  pointsAsc: readonly EngineChartPoint[],
  bucketMinutes: number,
): EngineChartPoint[] {
  const bucketMs = bucketMinutes * MS_PER_MINUTE;
  const result: EngineChartPoint[] = [];
  let lastBucket: number | null = null;
  for (const point of pointsAsc) {
    const bucket = Math.floor(Date.parse(point.timestamp) / bucketMs);
    if (bucket === lastBucket) {
      result[result.length - 1] = point;
      continue;
    }
    result.push(point);
    lastBucket = bucket;
  }
  return result;
}

/**
 * Puts the live head first and the series after it, newest first.
 * Intraday: drops samples that are not older than the head. Daily: the head replaces its own day.
 */
export function mergeEngineChartHead(
  head: EngineChartPoint,
  seriesAsc: readonly EngineChartPoint[],
  window: EngineChartWindow,
): EngineChartPoint[] {
  const headMs = Date.parse(head.timestamp);
  const seenDays = new Set<string>([head.dateString]);
  const descending: EngineChartPoint[] = [head];
  for (let index = seriesAsc.length - 1; index >= 0; index -= 1) {
    const point = seriesAsc[index];
    if (window.kind === 'intraday') {
      if (Date.parse(point.timestamp) < headMs) {
        descending.push(point);
      }
      continue;
    }
    if (!seenDays.has(point.dateString)) {
      seenDays.add(point.dateString);
      descending.push(point);
    }
  }
  return descending;
}
