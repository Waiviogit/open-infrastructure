import type { RedisStreamEntry } from './interface';

/**
 * Maps a raw Redis stream entry list (`[[id, [field, value, ...]], ...]`) to entries.
 *
 * Re-reading a consumer's own PEL (`XREADGROUP ... 0`) returns `[id, null]` for entries
 * already trimmed from the stream (`XADD MAXLEN ~`). Those come back with empty `fields`
 * so callers still ack them instead of crashing on the null field list.
 */
export function toStreamEntries(entryList: unknown): RedisStreamEntry[] {
  if (!Array.isArray(entryList)) {
    return [];
  }
  const out: RedisStreamEntry[] = [];
  for (const entry of entryList) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
      continue;
    }
    out.push({ id: entry[0], fields: toFieldMap(entry[1]) });
  }
  return out;
}

function toFieldMap(fieldList: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!Array.isArray(fieldList)) {
    return fields;
  }
  for (let i = 0; i + 1 < fieldList.length; i += 2) {
    const key = fieldList[i];
    const value = fieldList[i + 1];
    if (typeof key === 'string' && typeof value === 'string') {
      fields[key] = value;
    }
  }
  return fields;
}
