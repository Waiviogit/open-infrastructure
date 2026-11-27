import { mapWaivChart } from './map-waiv-chart';

describe('mapWaivChart', () => {
  it('orders points oldest first and uses timestamps when present', () => {
    const chart = mapWaivChart('1d', {
      result: [
        { dateString: '2026-11-27', timestamp: '2026-11-27T10:05:00.000Z', rates: { HIVE: 0.18, USD: 0.0066 } },
        { dateString: '2026-11-27', timestamp: '2026-11-27T10:00:00.000Z', rates: { HIVE: 0.17, USD: 0.0065 } },
      ],
      change: { HIVE: 1, USD: 1.5 },
      lowUSD: 0.0065,
      highUSD: 0.0066,
    });

    expect(chart.points.map((point) => point.time)).toEqual([
      Date.parse('2026-11-27T10:00:00.000Z'),
      Date.parse('2026-11-27T10:05:00.000Z'),
    ]);
    expect(chart.latest?.usd).toBe(0.0066);
    expect(chart.changeUsdPercent).toBe(1.5);
  });

  it('falls back to the day for legacy points and drops zero prices', () => {
    const chart = mapWaivChart('1m', {
      result: [
        { dateString: '2026-11-27', rates: { HIVE: 0, USD: 0 } },
        { dateString: '2026-11-26', rates: { HIVE: 0.17, USD: 0.0065 } },
      ],
      change: { HIVE: 0, USD: 0 },
      lowUSD: 0,
      highUSD: 0,
    });

    expect(chart.points).toEqual([
      { time: Date.parse('2026-11-26T00:00:00.000Z'), usd: 0.0065, hive: 0.17 },
    ]);
  });
});
