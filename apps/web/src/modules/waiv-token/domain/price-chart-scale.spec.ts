import { buildPriceChartGeometry, nearestPointIndex, niceTicks, priceRange } from './price-chart-scale';
import type { WaivChartPoint } from './waiv-token.types';

const points: WaivChartPoint[] = [
  { time: 0, usd: 0.0061, hive: 0.17 },
  { time: 1000, usd: 0.0069, hive: 0.18 },
  { time: 3000, usd: 0.0064, hive: 0.175 },
];

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    const { ticks, step, decimals } = niceTicks(0.0061, 0.0069, 5);
    expect(step).toBeCloseTo(0.0002, 10);
    expect(ticks[0]).toBeLessThanOrEqual(0.0061);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0.0069);
    expect(decimals).toBe(4);
  });

  it('widens a flat series so it still has a band', () => {
    const { ticks } = niceTicks(0.005, 0.005, 5);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[0]).toBeLessThan(0.005);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(0.005);
  });

  it('uses whole numbers for large values', () => {
    expect(niceTicks(0, 100, 5)).toMatchObject({ ticks: [0, 25, 50, 75, 100], decimals: 0 });
  });
});

describe('buildPriceChartGeometry', () => {
  const geometry = buildPriceChartGeometry({
    points,
    width: 400,
    height: 200,
    padding: { top: 10, right: 10, bottom: 20, left: 50 },
    yTickTarget: 5,
  });

  it('maps time to x across the plot width', () => {
    expect(geometry.coords[0].x).toBe(50);
    expect(geometry.coords[2].x).toBe(390);
    expect(geometry.coords[1].x).toBeCloseTo(50 + 340 / 3, 6);
  });

  it('puts higher prices higher up', () => {
    expect(geometry.coords[1].y).toBeLessThan(geometry.coords[0].y);
  });

  it('closes the area on the plot bottom', () => {
    expect(geometry.linePath.startsWith('M50.00,')).toBe(true);
    expect(geometry.areaPath.endsWith('L390.00,180L50.00,180Z')).toBe(true);
  });

  it('returns empty paths for no points', () => {
    const empty = buildPriceChartGeometry({
      points: [],
      width: 400,
      height: 200,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      yTickTarget: 5,
    });
    expect(empty.linePath).toBe('');
    expect(empty.areaPath).toBe('');
  });
});

describe('nearestPointIndex', () => {
  it.each([
    [-50, 0],
    [400, 0],
    [600, 1],
    [1900, 1],
    [2100, 2],
    [99999, 2],
  ])('time %p → index %p', (time, index) => {
    expect(nearestPointIndex(points, time)).toBe(index);
  });

  it('returns -1 for no points', () => {
    expect(nearestPointIndex([], 0)).toBe(-1);
  });
});

describe('priceRange', () => {
  it('returns the lowest and highest price', () => {
    expect(priceRange(points)).toEqual({ low: 0.0061, high: 0.0069 });
    expect(priceRange([])).toBeNull();
  });
});
