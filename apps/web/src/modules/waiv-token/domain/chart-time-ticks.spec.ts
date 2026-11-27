import { buildTimeTicks, formatPointTime, formatTimeTick } from './chart-time-ticks';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('buildTimeTicks', () => {
  it('uses hour ticks for one day', () => {
    const start = Date.UTC(2026, 10, 26, 10, 7);
    const { ticks, format } = buildTimeTicks(start, start + DAY, 8);
    expect(format).toBe('time');
    expect(ticks.length).toBeLessThanOrEqual(9);
    expect(ticks.every((tick) => tick % (3 * HOUR) === 0)).toBe(true);
    expect(ticks[0]).toBeGreaterThanOrEqual(start);
  });

  it('uses weekday ticks at UTC midnight for a week', () => {
    const start = Date.UTC(2026, 10, 20, 12);
    const { ticks, format } = buildTimeTicks(start, start + 7 * DAY, 8);
    expect(format).toBe('weekday');
    expect(ticks).toHaveLength(7);
    expect(ticks.every((tick) => tick % DAY === 0)).toBe(true);
  });

  it('uses weekly Monday ticks for a month on a narrow chart', () => {
    const start = Date.UTC(2026, 9, 27);
    const { ticks, format } = buildTimeTicks(start, start + 31 * DAY, 5);
    expect(format).toBe('day-month');
    expect(ticks.every((tick) => new Date(tick).getUTCDay() === 1)).toBe(true);
  });

  it('uses month starts for a year', () => {
    const start = Date.UTC(2025, 10, 20);
    const { ticks, format } = buildTimeTicks(start, Date.UTC(2026, 10, 27), 7);
    expect(format).toBe('month');
    expect(ticks.every((tick) => new Date(tick).getUTCDate() === 1)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it('uses years for the whole history', () => {
    const { format, ticks } = buildTimeTicks(Date.UTC(2021, 8, 30), Date.UTC(2026, 10, 27), 6);
    expect(format).toBe('year');
    expect(ticks).toEqual([
      Date.UTC(2022, 0, 1),
      Date.UTC(2023, 0, 1),
      Date.UTC(2024, 0, 1),
      Date.UTC(2025, 0, 1),
      Date.UTC(2026, 0, 1),
    ]);
  });
});

describe('formatTimeTick', () => {
  it('formats in UTC regardless of the runtime zone', () => {
    expect(formatTimeTick(Date.UTC(2026, 10, 27, 21, 0), 'time', 'en-US')).toBe('21:00');
    expect(formatTimeTick(Date.UTC(2026, 10, 23), 'weekday', 'en-US')).toBe('Mon');
    expect(formatTimeTick(Date.UTC(2026, 0, 1), 'year', 'en-US')).toBe('2026');
  });
});

describe('formatPointTime', () => {
  it('adds the UTC time for intraday points only', () => {
    expect(formatPointTime(Date.UTC(2026, 10, 27, 9, 5), true, 'en-US')).toBe('Nov 27, 09:05 UTC');
    expect(formatPointTime(Date.UTC(2026, 10, 27), false, 'en-US')).toBe('Nov 27, 2026');
  });
});

describe('buildTimeTicks on a narrow chart', () => {
  it('keeps more than one label for a month', () => {
    const start = Date.UTC(2026, 9, 27);
    const { ticks } = buildTimeTicks(start, start + 31 * DAY, 2);
    expect(ticks.length).toBeGreaterThan(1);
  });
});
