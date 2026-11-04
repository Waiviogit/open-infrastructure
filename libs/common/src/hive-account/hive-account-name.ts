export const HIVE_ACCOUNT_NAME_MIN_LENGTH = 3;
export const HIVE_ACCOUNT_NAME_MAX_LENGTH = 16;

const HIVE_ACCOUNT_SEGMENT_MIN_LENGTH = 3;
const HIVE_ACCOUNT_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;

/**
 * Hive account name grammar, same as hived `is_valid_account_name`: 3–16 chars, dot-separated
 * segments of 3+ chars, each segment starts with a letter, ends with a letter or digit and holds
 * only `a-z`, `0-9` and `-`. Expects an already normalized (lowercase, no `@`) name.
 * @see docs/standards/core-imports.md
 */
export function isHiveAccountName(name: string): boolean {
  if (
    name.length < HIVE_ACCOUNT_NAME_MIN_LENGTH ||
    name.length > HIVE_ACCOUNT_NAME_MAX_LENGTH
  ) {
    return false;
  }
  return name
    .split('.')
    .every(
      (segment) =>
        segment.length >= HIVE_ACCOUNT_SEGMENT_MIN_LENGTH &&
        HIVE_ACCOUNT_SEGMENT_PATTERN.test(segment),
    );
}

/** User input → account name candidate: trims, drops leading `@` characters, lowercases. */
export function normalizeHiveAccountInput(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}
