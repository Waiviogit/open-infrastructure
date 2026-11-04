import { isHiveAccountName } from '@opden-data-layer/common';

/**
 * Memo format for a WAIV transfer that pays an OBL debt on behalf of another account.
 * The transfer recipient is the receiver; the memo names the debtor.
 * @see docs/spec/obl/payments.md
 */
export const OBL_ON_BEHALF_MEMO_PREFIX = 'obl:on-behalf:';

export function buildOblOnBehalfMemo(debtor: string): string {
  return `${OBL_ON_BEHALF_MEMO_PREFIX}${debtor.trim()}`;
}

/** Returns the debtor account named in the memo, or `null` when the memo is not an on-behalf memo. */
export function parseOblOnBehalfMemo(memo: string | null | undefined): string | null {
  if (typeof memo !== 'string') {
    return null;
  }
  const trimmed = memo.trim();
  if (!trimmed.startsWith(OBL_ON_BEHALF_MEMO_PREFIX)) {
    return null;
  }
  const debtor = trimmed.slice(OBL_ON_BEHALF_MEMO_PREFIX.length);
  return isHiveAccountName(debtor) ? debtor : null;
}
