import type { WaivChartPoint } from './waiv-token.types';

export type ChartPadding = { top: number; right: number; bottom: number; left: number };

export type PriceChartGeometry = {
  /** Plot area in SVG pixels. */
  plot: { left: number; top: number; right: number; bottom: number };
  xOf: (time: number) => number;
  yOf: (value: number) => number;
  yTicks: number[];
  /** Decimal places that tell neighbouring y ticks apart. */
  yTickDecimals: number;
  linePath: string;
  areaPath: string;
  coords: Array<{ x: number; y: number }>;
};

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;
const MAX_TICK_DECIMALS = 8;
/** Flat series still get a visible band (±0.5% around the value). */
const FLAT_SERIES_RELATIVE_PAD = 0.005;

function niceStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const fraction = rawStep / magnitude;
  const nice = NICE_STEPS.find((step) => fraction <= step) ?? 10;
  return nice * magnitude;
}

function decimalsForStep(step: number): number {
  if (!(step > 0)) {
    return 0;
  }
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (step % 1 === 0 ? 0 : 1));
  const exact = Number(step.toFixed(MAX_TICK_DECIMALS));
  for (let digits = 0; digits <= MAX_TICK_DECIMALS; digits += 1) {
    if (Number(exact.toFixed(digits)) === exact) {
      return Math.min(digits, MAX_TICK_DECIMALS);
    }
  }
  return Math.min(decimals, MAX_TICK_DECIMALS);
}

/** Round tick values covering `[min, max]`, about `targetCount` of them. */
export function niceTicks(
  min: number,
  max: number,
  targetCount: number,
): { ticks: number[]; step: number; decimals: number } {
  let low = min;
  let high = max;
  if (!(high > low)) {
    const pad = Math.abs(low) * FLAT_SERIES_RELATIVE_PAD || 1;
    low -= pad;
    high += pad;
  }
  const step = niceStep((high - low) / Math.max(1, targetCount - 1));
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const decimals = decimalsForStep(step);
  const ticks: number[] = [];
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Number(value.toFixed(decimals + 2)));
  }
  return { ticks, step, decimals };
}

/** Line, area and scales for an ascending price series inside `width × height`. */
export function buildPriceChartGeometry(params: {
  points: readonly WaivChartPoint[];
  width: number;
  height: number;
  padding: ChartPadding;
  yTickTarget: number;
}): PriceChartGeometry {
  const { points, width, height, padding } = params;
  const plot = {
    left: padding.left,
    top: padding.top,
    right: Math.max(padding.left + 1, width - padding.right),
    bottom: Math.max(padding.top + 1, height - padding.bottom),
  };

  const values = points.map((point) => point.usd);
  const { ticks, decimals } = niceTicks(
    values.length ? Math.min(...values) : 0,
    values.length ? Math.max(...values) : 1,
    params.yTickTarget,
  );
  const yMin = ticks[0] ?? 0;
  const yMax = ticks[ticks.length - 1] ?? 1;
  const tMin = points[0]?.time ?? 0;
  const tMax = points[points.length - 1]?.time ?? tMin + 1;
  const tSpan = tMax - tMin || 1;
  const ySpan = yMax - yMin || 1;

  const xOf = (time: number) =>
    plot.left + ((time - tMin) / tSpan) * (plot.right - plot.left);
  const yOf = (value: number) =>
    plot.bottom - ((value - yMin) / ySpan) * (plot.bottom - plot.top);

  const coords = points.map((point) => ({ x: xOf(point.time), y: yOf(point.usd) }));
  const linePath = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
    .join('');
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath =
    first && last
      ? `${linePath}L${last.x.toFixed(2)},${plot.bottom}L${first.x.toFixed(2)},${plot.bottom}Z`
      : '';

  return { plot, xOf, yOf, yTicks: ticks, yTickDecimals: decimals, linePath, areaPath, coords };
}

/** Lowest and highest USD price of the plotted points (null for an empty series). */
export function priceRange(points: readonly WaivChartPoint[]): { low: number; high: number } | null {
  if (points.length === 0) {
    return null;
  }
  let low = points[0].usd;
  let high = points[0].usd;
  for (const point of points) {
    low = Math.min(low, point.usd);
    high = Math.max(high, point.usd);
  }
  return { low, high };
}

/** Index of the point closest in time to `time` (points ascending). */
export function nearestPointIndex(points: readonly WaivChartPoint[], time: number): number {
  if (points.length === 0) {
    return -1;
  }
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid].time <= time) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.abs(points[high].time - time) < Math.abs(points[low].time - time) ? high : low;
}
