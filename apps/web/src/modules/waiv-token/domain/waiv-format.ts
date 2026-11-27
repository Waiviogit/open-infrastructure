const PRICE_SIGNIFICANT_DIGITS = 4;
const TOKEN_FRACTION_DIGITS = 3;

/** WAIV prices are fractions of a cent: keep four significant digits. */
export function formatUsdPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumSignificantDigits: PRICE_SIGNIFICANT_DIGITS,
  }).format(value);
}

/** Axis ticks: enough decimals to tell neighbouring ticks apart, no more. */
export function formatUsdTick(value: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatUsdAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatTokenAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 1000 ? 0 : TOKEN_FRACTION_DIGITS,
  }).format(value);
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Share of a whole, `value` already in 0–100. */
export function formatShare(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value / 100);
}

/** A published rate (e.g. annual inflation 4.73 %), `value` already in percent. */
export function formatRate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(
    value / 100,
  );
}

/** Signed change with two decimals, `value` already in percent. */
export function formatSignedPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/** Price of one token in another pool token (e.g. 0.1806 SWAP.HIVE). */
export function formatRatio(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: PRICE_SIGNIFICANT_DIGITS }).format(
    value,
  );
}
