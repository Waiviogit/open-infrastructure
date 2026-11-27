import type { WaivChart, WaivChartPeriod, WaivChartPoint } from '../../domain/waiv-token.types';
import type { WaivChartApiResponse } from '../dto/waiv-api.schema';

function pointTime(point: WaivChartApiResponse['result'][number]): number {
  const fromTimestamp = point.timestamp ? Date.parse(point.timestamp) : Number.NaN;
  if (Number.isFinite(fromTimestamp)) {
    return fromTimestamp;
  }
  return Date.parse(`${point.dateString}T00:00:00.000Z`);
}

/** API points (newest first) → ascending points with valid times and positive prices. */
export function mapWaivChart(period: WaivChartPeriod, response: WaivChartApiResponse): WaivChart {
  const points: WaivChartPoint[] = response.result
    .map((point) => ({ time: pointTime(point), usd: point.rates.USD, hive: point.rates.HIVE }))
    .filter((point) => Number.isFinite(point.time) && point.usd > 0)
    .sort((left, right) => left.time - right.time);

  return {
    period,
    points,
    changeUsdPercent: response.change.USD,
    latest: points[points.length - 1] ?? null,
  };
}
