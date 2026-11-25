/**
 * Prefix range upper bound for btree `col >= prefix AND col < upper`.
 * ASCII increment on last code unit (Hive account names; kebab `object_id` only with `COLLATE "C"` —
 * locale collations treat `-` and `.` as equal, so `kvu-` → `kvu.` is an empty range).
 */
export function prefixUpperBound(prefix: string): string {
  if (prefix.length === 0) {
    return prefix;
  }
  const last = prefix.charCodeAt(prefix.length - 1);
  if (last >= 0xffff) {
    return `${prefix}\uffff`;
  }
  return prefix.slice(0, -1) + String.fromCharCode(last + 1);
}

/** Escapes `\`, `%` and `_` for `LIKE` / `ILIKE … ESCAPE '\'` and btree prefix ranges. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
