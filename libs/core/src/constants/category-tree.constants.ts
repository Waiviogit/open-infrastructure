import { objectTypeSupportsCategories } from '../object-type-registry/category-object-types';

/** Sentinel `category_name` row in `object_categories_related` for uncategorized group count. */
export const UNCATEGORIZED_CATEGORY_SENTINEL = '__uncategorized__';

const SCOPE_KEY_SEPARATOR = ':';

/**
 * Canonical user `scope_key` for `object_categories_related`: one scope per account and
 * category object type (`alice:recipe`).
 */
export function buildUserCategoryScopeKey(account: string, objectType: string): string {
  return `${account.trim()}${SCOPE_KEY_SEPARATOR}${objectType.trim()}`;
}

/**
 * Parses a user `scope_key`. Returns `null` for legacy keys (no separator, multi-type
 * `alice:book,product`) and for types that no longer support `category`.
 */
export function parseUserCategoryScopeKey(
  scopeKey: string,
): { account: string; objectType: string } | null {
  const trimmed = scopeKey.trim();
  const separatorIdx = trimmed.lastIndexOf(SCOPE_KEY_SEPARATOR);
  if (separatorIdx <= 0) {
    return null;
  }
  const account = trimmed.slice(0, separatorIdx).trim();
  const objectType = trimmed.slice(separatorIdx + 1).trim();
  if (account.length === 0 || !objectTypeSupportsCategories(objectType)) {
    return null;
  }
  return { account, objectType };
}
