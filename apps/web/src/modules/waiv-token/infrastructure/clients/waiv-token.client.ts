import 'server-only';

import { queryApiFetchOutcome } from '@/modules/user-profile/infrastructure/clients/query-api.client';

import { mapWaivChart } from '../../application/mappers/map-waiv-chart';
import {
  waivChartApiSchema,
  waivStatsApiSchema,
  waivSwapsPageApiSchema,
} from '../../application/dto/waiv-api.schema';
import type {
  WaivChart,
  WaivChartPeriod,
  WaivStats,
  WaivSwapsPage,
} from '../../domain/waiv-token.types';

export const WAIV_SWAPS_PAGE_SIZE = 20;

const WAIV_BASE = 'WAIV';

/** query-api caches stats for 5 min; the web cache only spares the round trip. */
export async function fetchWaivStats(): Promise<WaivStats | null> {
  const outcome = await queryApiFetchOutcome<unknown>('/query/v1/waiv/stats', {
    cacheTags: ['query-api:waiv:stats'],
  });
  if (!outcome.ok) {
    return null;
  }
  const parsed = waivStatsApiSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : null;
}

export async function fetchWaivChart(period: WaivChartPeriod): Promise<WaivChart | null> {
  const query = new URLSearchParams({ period, base: WAIV_BASE });
  const outcome = await queryApiFetchOutcome<unknown>(
    `/query/v1/currency/engine/chart?${query.toString()}`,
    { cacheTags: [`query-api:currency:engine-chart:${period}`] },
  );
  if (!outcome.ok) {
    return null;
  }
  const parsed = waivChartApiSchema.safeParse(outcome.data);
  return parsed.success ? mapWaivChart(period, parsed.data) : null;
}

export async function fetchWaivSwaps(cursor: string | null): Promise<WaivSwapsPage | null> {
  const query = new URLSearchParams({ limit: String(WAIV_SWAPS_PAGE_SIZE) });
  if (cursor) {
    query.set('cursor', cursor);
  }
  const outcome = await queryApiFetchOutcome<unknown>(`/query/v1/waiv/swaps?${query.toString()}`, {
    cacheTags: ['query-api:waiv:swaps'],
  });
  if (!outcome.ok) {
    return null;
  }
  const parsed = waivSwapsPageApiSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : null;
}
