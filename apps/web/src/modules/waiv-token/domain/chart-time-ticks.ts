const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Even a narrow chart keeps a start, middle and end label. */
const MIN_TICKS = 3;

type TickUnit =
  | { kind: 'hours'; count: number }
  | { kind: 'days'; count: number }
  | { kind: 'months'; count: number };

/** Candidate spacings, smallest first; the first that fits `maxTicks` wins. */
const TICK_UNITS: readonly TickUnit[] = [
  { kind: 'hours', count: 1 },
  { kind: 'hours', count: 3 },
  { kind: 'hours', count: 6 },
  { kind: 'hours', count: 12 },
  { kind: 'days', count: 1 },
  { kind: 'days', count: 2 },
  { kind: 'days', count: 7 },
  { kind: 'days', count: 14 },
  { kind: 'months', count: 1 },
  { kind: 'months', count: 2 },
  { kind: 'months', count: 3 },
  { kind: 'months', count: 6 },
  { kind: 'months', count: 12 },
  { kind: 'months', count: 24 },
];

export type TimeTickFormat = 'time' | 'weekday' | 'day-month' | 'month' | 'month-year' | 'year';

export type TimeTicks = { ticks: number[]; format: TimeTickFormat };

function approxUnitMs(unit: TickUnit): number {
  if (unit.kind === 'hours') {
    return unit.count * HOUR_MS;
  }
  if (unit.kind === 'days') {
    return unit.count * DAY_MS;
  }
  return unit.count * 30.44 * DAY_MS;
}

function ticksForUnit(start: number, end: number, unit: TickUnit): number[] {
  const ticks: number[] = [];
  if (unit.kind === 'months') {
    const first = new Date(start);
    const year = first.getUTCFullYear();
    let month = first.getUTCMonth();
    month = Math.ceil(month / unit.count) * unit.count;
    for (;;) {
      const time = Date.UTC(year + Math.floor(month / 12), month % 12, 1);
      if (time > end) {
        break;
      }
      if (time >= start) {
        ticks.push(time);
      }
      month += unit.count;
    }
    return ticks;
  }
  const stepMs = approxUnitMs(unit);
  /** Weekly ticks land on Mondays (1970-01-05 was a Monday). */
  const offset = unit.kind === 'days' && unit.count === 7 ? 4 * DAY_MS : 0;
  let time = Math.ceil((start - offset) / stepMs) * stepMs + offset;
  for (; time <= end; time += stepMs) {
    ticks.push(time);
  }
  return ticks;
}

function formatForUnit(unit: TickUnit, spanMs: number): TimeTickFormat {
  if (unit.kind === 'hours') {
    return 'time';
  }
  if (unit.kind === 'days') {
    return unit.count === 1 && spanMs <= 8 * DAY_MS ? 'weekday' : 'day-month';
  }
  if (unit.count >= 12) {
    return 'year';
  }
  return spanMs > 400 * DAY_MS ? 'month-year' : 'month';
}

/** Round UTC instants between `start` and `end`, at most `maxTicks` of them. */
export function buildTimeTicks(start: number, end: number, maxTicks: number): TimeTicks {
  const span = Math.max(1, end - start);
  const limit = Math.max(MIN_TICKS, maxTicks);
  const unit =
    TICK_UNITS.find((candidate) => span / approxUnitMs(candidate) <= limit) ??
    TICK_UNITS[TICK_UNITS.length - 1];
  return { ticks: ticksForUnit(start, end, unit), format: formatForUnit(unit, span) };
}

const TICK_FORMAT_OPTIONS: Record<TimeTickFormat, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  weekday: { weekday: 'short' },
  'day-month': { day: 'numeric', month: 'short' },
  month: { month: 'short' },
  'month-year': { month: 'short', year: '2-digit' },
  year: { year: 'numeric' },
};

/** Axis label in UTC, so the server and the browser render the same text. */
export function formatTimeTick(time: number, format: TimeTickFormat, locale: string): string {
  return new Intl.DateTimeFormat(locale, { ...TICK_FORMAT_OPTIONS[format], timeZone: 'UTC' }).format(
    time,
  );
}

/** Tooltip time: date + time (UTC) for intraday points, the date alone for daily points. */
export function formatPointTime(time: number, intraday: boolean, locale: string): string {
  const options: Intl.DateTimeFormatOptions = intraday
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  const label = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(time);
  return intraday ? `${label} UTC` : label;
}
