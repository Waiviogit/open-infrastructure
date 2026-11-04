/**
 * Memo format for a WAIV transfer that pays an OBL debt on behalf of another account.
 * The transfer recipient is the receiver; the memo names the debtor.
 * @see docs/spec/obl/payments.md
 */
export const OBL_ON_BEHALF_MEMO_PREFIX = 'obl:on-behalf:';

const HIVE_ACCOUNT_MIN_LENGTH = 3;
const HIVE_ACCOUNT_MAX_LENGTH = 16;
const HIVE_ACCOUNT_SEGMENT = /^[a-z][a-z0-9-]{1,}[a-z0-9]$/;

/**
 * Hive account name rules (3–16 chars, dot-separated segments of 3+ chars, each starting with a
 * letter and ending with a letter or digit). Web-safe: no dhive dependency.
 */
export function isOblHiveAccountName(value: string): boolean {
  if (value.length < HIVE_ACCOUNT_MIN_LENGTH || value.length > HIVE_ACCOUNT_MAX_LENGTH) {
    return false;
  }
  return value.split('.').every((segment) => HIVE_ACCOUNT_SEGMENT.test(segment));
}

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
  return isOblHiveAccountName(debtor) ? debtor : null;
}
