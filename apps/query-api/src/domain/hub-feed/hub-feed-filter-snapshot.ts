import type { HubFeedFollowCountRow } from '../../repositories';
import {
  HUB_FEED_COUNTER_BUCKET_SEC,
  HUB_FEED_COUNTER_WINDOW_HOURS,
} from './hub-feed.constants';

export interface HubFeedFilterUserEntry {
  name: string;
  count: number | null;
  lastItemUnix: number;
}

export interface HubFeedFilterObjectEntry {
  objectId: string;
  count: number | null;
  lastItemUnix: number;
}

export interface HubFeedFilterTypeEntry {
  objectType: string;
  /** Sum of the type's object counts (an item linked to two objects counts twice). */
  count: number | null;
  objects: HubFeedFilterObjectEntry[];
}

/**
 * Sorted follows of one account for one tab: only follows that have items on the tab,
 * so empty sections never appear. What the rail renders, before hydration.
 */
export interface HubFeedFilterSnapshot {
  windowStart: number;
  countsAvailable: boolean;
  users: HubFeedFilterUserEntry[];
  objectTypes: HubFeedFilterTypeEntry[];
}

/** First bucket hour of the counter window: the current hour plus the 71 before it. */
export function hubFeedCounterWindowStart(nowUnixSec: number): number {
  const currentHour = Math.floor(nowUnixSec / HUB_FEED_COUNTER_BUCKET_SEC) * HUB_FEED_COUNTER_BUCKET_SEC;
  return currentHour - (HUB_FEED_COUNTER_WINDOW_HOURS - 1) * HUB_FEED_COUNTER_BUCKET_SEC;
}

function newestFirst<T extends { count: number | null; lastItemUnix: number }>(
  tieBreak: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) =>
    (b.count ?? 0) - (a.count ?? 0) || b.lastItemUnix - a.lastItemUnix || tieBreak(a, b);
}

/**
 * Orders the rail: rows with more new items first, then the most recently active, then
 * by name / id; types by summed new items, then their most recent object, then name.
 */
export function buildHubFeedFilterSnapshot(
  rows: readonly HubFeedFollowCountRow[],
  windowStart: number,
  countsAvailable: boolean,
): HubFeedFilterSnapshot {
  const users: HubFeedFilterUserEntry[] = [];
  const objectsByType = new Map<string, HubFeedFilterObjectEntry[]>();

  for (const row of rows) {
    const count = countsAvailable ? (row.count ?? 0) : null;
    if (row.kind === 'user') {
      users.push({ name: row.id, count, lastItemUnix: row.last_item_unix });
      continue;
    }
    const type = row.object_type ?? '';
    const list = objectsByType.get(type) ?? [];
    list.push({ objectId: row.id, count, lastItemUnix: row.last_item_unix });
    objectsByType.set(type, list);
  }

  users.sort(newestFirst((a, b) => a.name.localeCompare(b.name)));

  const types = [...objectsByType.entries()].map(([objectType, objects]) => ({
    objectType,
    count: countsAvailable ? objects.reduce((sum, o) => sum + (o.count ?? 0), 0) : null,
    lastItemUnix: Math.max(...objects.map((o) => o.lastItemUnix)),
    objects: objects.sort(newestFirst((a, b) => a.objectId.localeCompare(b.objectId))),
  }));
  types.sort(newestFirst((a, b) => a.objectType.localeCompare(b.objectType)));

  return {
    windowStart,
    countsAvailable,
    users,
    objectTypes: types.map(({ objectType, count, objects }) => ({ objectType, count, objects })),
  };
}
