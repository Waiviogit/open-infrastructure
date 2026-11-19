/**
 * One USD formatter for every Market amount (balances, invoices, payments, disputes, modals).
 *
 * Deterministic on purpose (no `Intl` locale data): server and client render the same string,
 * so hydrated amounts never mismatch. Output: `$1,234,567.89`, `−$50.00` (U+2212 minus).
 */

const MINUS = '−';
const EMPTY = '—';
const FRACTION_DIGITS = 2;

export type FormatUsdOptions = {
  /** Prefix positive values with `+` (ledger rows that show direction by sign). */
  signed?: boolean;
};

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
  const [integerPart, fraction] = Math.abs(n)
    .toFixed(FRACTION_DIGITS)
    .split('.');
  const body = `$${groupThousands(integerPart)}.${fraction}`;
  const isZero = Number(Math.abs(n).toFixed(FRACTION_DIGITS)) === 0;
  if (n < 0 && !isZero) {
    return `${MINUS}${body}`;
  }
  if (options.signed && !isZero) {
    return `+${body}`;
  }
  return body;
}
