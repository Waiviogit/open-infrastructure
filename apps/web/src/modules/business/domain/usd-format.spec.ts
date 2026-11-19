import { formatUsd, parseUsdAmount } from './usd-format';

describe('formatUsd', () => {
  it('groups thousands and keeps two decimals', () => {
    expect(formatUsd('1234567.891')).toBe('$1,234,567.89');
    expect(formatUsd(100)).toBe('$100.00');
    expect(formatUsd('0.5')).toBe('$0.50');
  });

  it('uses a real minus sign before the currency symbol', () => {
    expect(formatUsd('-1234567.89')).toBe('−$1,234,567.89');
  });

  it('prefixes positives with + only when signed', () => {
    expect(formatUsd(50, { signed: true })).toBe('+$50.00');
    expect(formatUsd(-50, { signed: true })).toBe('−$50.00');
  });

  it('never shows a signed zero', () => {
    expect(formatUsd(0, { signed: true })).toBe('$0.00');
    expect(formatUsd('-0.001')).toBe('$0.00');
  });

  it('renders a dash for missing or invalid values', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd('')).toBe('—');
    expect(formatUsd('abc')).toBe('—');
  });
});

describe('parseUsdAmount', () => {
  it('parses numeric strings and rejects garbage', () => {
    expect(parseUsdAmount('12.5')).toBe(12.5);
    expect(parseUsdAmount(undefined)).toBeNull();
    expect(parseUsdAmount('NaN')).toBeNull();
  });
});
