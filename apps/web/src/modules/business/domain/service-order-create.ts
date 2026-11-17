export function canCreateServiceOrderOnContract(c: {
  offer_status?: 'active' | 'retired';
}): boolean {
  return c.offer_status !== 'retired';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Compacted value, or `undefined` when nothing meaningful is left. */
function compactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? undefined : value;
  }
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compactValue(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

/**
 * Service-order details as written on chain. The form prefills every schema field
 * (`''`, `[]`, `null` where the offer gives no default); untouched ones are not set.
 * `false` and `0` are kept: they can be deliberate values.
 */
export function compactServiceOrderDetails(
  details: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const compacted = compactValue(details);
  return isPlainObject(compacted) ? compacted : undefined;
}
