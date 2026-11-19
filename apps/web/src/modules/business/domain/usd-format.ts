/**
 * One USD formatter for every Market amount (balances, invoices, payments, disputes, modals).
 *
 * Deterministic on purpose (no `Intl` locale data): server and client render the same string,
 * so hydrated amounts never mismatch. Output: `$1,234,567.89`, `−$50.00` (U+2212 minus).
 */

const MINUS = '−';
const EMPTY = '—';
const FRACTION_DIGITS = 2;
/** Precise mode: sub-cent amounts keep two significant digits, capped at the on-chain 8 decimals. */
const PRECISE_SIGNIFICANT_DIGITS = 2;
const MAX_FRACTION_DIGITS = 8;
const CENT = 0.01;

export type FormatUsdOptions = {
  /** Prefix positive values with `+` (ledger rows that show direction by sign). */
  signed?: boolean;
  /**
   * Sub-cent amounts (curation rewards) read `$0.00026` instead of rounding to `$0.00`.
   * A cent or more keeps two decimals.
   */
  precise?: boolean;
};

function fractionDigitsFor(abs: number, precise: boolean): number {
  if (!precise || abs === 0 || abs >= CENT) {
    return FRACTION_DIGITS;
  }
  const leadingZeros = -Math.floor(Math.log10(abs)) - 1;
  return Math.min(
    MAX_FRACTION_DIGITS,
    leadingZeros + PRECISE_SIGNIFICANT_DIGITS,
  );
}

export function parseUsdAmount(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatUsd(
  value: string | number | null | undefined,
  options: FormatUsdOptions = {},
): string {
  const n = parseUsdAmount(value);
  if (n === null) {
    return EMPTY;
  }
  const abs = Math.abs(n);
  const digits = fractionDigitsFor(abs, options.precise === true);
  const [integerPart, fraction] = abs.toFixed(digits).split('.');
  const body = `$${groupThousands(integerPart)}.${fraction}`;
  const isZero = Number(abs.toFixed(digits)) === 0;
  if (n < 0 && !isZero) {
    return `${MINUS}${body}`;
  }
  if (options.signed && !isZero) {
    return `+${body}`;
  }
  return body;
}
