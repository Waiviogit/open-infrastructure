/** Badge state for an invoice row (a `pending` invoice waits for the debtor's signature). */
export type InvoiceBadgeState =
  | 'confirmed'
  | 'pending_signature'
  | 'disputed'
  | 'resolved';

export function invoiceBadgeState(state: string): InvoiceBadgeState {
  if (state === 'pending') {
    return 'pending_signature';
  }
  if (state === 'disputed') {
    return 'disputed';
  }
  if (state === 'resolved') {
    return 'resolved';
  }
  return 'confirmed';
}

const SUMMARY_KEYS = [
  'title',
  'memo',
  'report',
  'summary',
  'description',
] as const;

/**
 * One human line for an invoice / service order / report from its free-form `details`:
 * the first known text field. Never dumps JSON as a label.
 */
export function ledgerDetailsSummary(
  details: Record<string, unknown> | null | undefined,
): string | null {
  if (!details) {
    return null;
  }
  for (const key of SUMMARY_KEYS) {
    const value = details[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/** Plain `key: value` pairs of free-form details for a definition list (nested values as JSON). */
export function ledgerDetailsEntries(
  details: Record<string, unknown> | null | undefined,
): Array<{ key: string; value: string }> {
  if (!details) {
    return [];
  }
  return Object.entries(details)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    )
    .map(([key, value]) => ({
      key,
      value:
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value),
    }));
}
