import 'server-only';

import {
  fetchWaivChart,
  fetchWaivStats,
  fetchWaivSwaps,
} from '../../infrastructure/clients/waiv-token.client';
import {
  isWaivChartPeriod,
  WAIV_CHART_DEFAULT_PERIOD,
  type WaivChart,
  type WaivChartPeriod,
  type WaivStats,
  type WaivSwapsPage,
} from '../../domain/waiv-token.types';

export type WaivStatsPageData = {
  stats: WaivStats | null;
  chart: WaivChart | null;
};

/** Stats tab first paint: stats + the default chart period, fetched together. */
export async function getWaivStatsPageData(): Promise<WaivStatsPageData> {
  const [stats, chart] = await Promise.all([
    fetchWaivStats(),
    fetchWaivChart(WAIV_CHART_DEFAULT_PERIOD),
  ]);
  return { stats, chart };
}

/** Unknown periods resolve to `null` so the route can answer 400. */
export function parseWaivChartPeriod(raw: string | null): WaivChartPeriod | null {
  return raw && isWaivChartPeriod(raw) ? raw : null;
}

export function getWaivChart(period: WaivChartPeriod): Promise<WaivChart | null> {
  return fetchWaivChart(period);
}

export function getWaivSwapsPage(cursor: string | null): Promise<WaivSwapsPage | null> {
  return fetchWaivSwaps(cursor);
}
