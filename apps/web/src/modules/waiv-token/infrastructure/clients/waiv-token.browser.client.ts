import { waivChartViewSchema, waivSwapsPageApiSchema } from '../../application/dto/waiv-api.schema';
import type { WaivChart, WaivChartPeriod, WaivSwapsPage } from '../../domain/waiv-token.types';

export type WaivBrowserResult<T> = { ok: true; data: T } | { ok: false; aborted: boolean };

async function getJson<T>(
  url: string,
  signal: AbortSignal | undefined,
  parse: (json: unknown) => T | null,
): Promise<WaivBrowserResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    if (!response.ok) {
      return { ok: false, aborted: false };
    }
    const data = parse(await response.json());
    return data === null ? { ok: false, aborted: false } : { ok: true, data };
  } catch (e) {
    return { ok: false, aborted: (e as Error).name === 'AbortError' };
  }
}

export function fetchWaivChartClient(
  period: WaivChartPeriod,
  signal?: AbortSignal,
): Promise<WaivBrowserResult<WaivChart>> {
  const query = new URLSearchParams({ period });
  return getJson(`/api/waiv/chart?${query.toString()}`, signal, (json) => {
    const parsed = waivChartViewSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  });
}

export function fetchWaivSwapsClient(
  cursor: string,
  signal?: AbortSignal,
): Promise<WaivBrowserResult<WaivSwapsPage>> {
  const query = new URLSearchParams({ cursor });
  return getJson(`/api/waiv/swaps?${query.toString()}`, signal, (json) => {
    const parsed = waivSwapsPageApiSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  });
}
