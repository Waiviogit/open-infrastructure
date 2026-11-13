import type { HubFeedFollowCountRow } from '../../repositories';
import {
  HUB_FEED_COUNTER_BUCKET_SEC,
  HUB_FEED_COUNTER_WINDOW_HOURS,
} from './hub-feed.constants';

export interface HubFeedFilterUserEntry {
  name: string;
  count: number | null;
  weight: number;
}

export interface HubFeedFilterObjectEntry {
  objectId: string;
  count: number | null;
  weight: number;
}

export interface HubFeedFilterTypeEntry {
  objectType: string;
  /** Sum of the type's object counts (an item linked to two objects counts twice). */
  count: number | null;
  objects: HubFeedFilterObjectEntry[];
}

/** Sorted follows of one account for one tab: what the rail renders, before hydration. */
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

function byCountThenWeight<T extends { count: number | null; weight: number }>(
  tieBreak: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => (b.count ?? 0) - (a.count ?? 0) || b.weight - a.weight || tieBreak(a, b);
}

/**
 * Orders the rail: accounts by new items, then expertise weight, then name; objects inside
 * a type by new items, then object weight, then id; types by summed new items, then name.
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
      users.push({ name: row.id, count, weight: row.weight });
      continue;
    }
    const type = row.object_type ?? '';
    const list = objectsByType.get(type) ?? [];
    list.push({ objectId: row.id, count, weight: row.weight });
    objectsByType.set(type, list);
  }

  users.sort(byCountThenWeight((a, b) => a.name.localeCompare(b.name)));

  const objectTypes: HubFeedFilterTypeEntry[] = [...objectsByType.entries()].map(
    ([objectType, objects]) => ({
      objectType,
      count: countsAvailable ? objects.reduce((sum, o) => sum + (o.count ?? 0), 0) : null,
      objects: objects.sort(byCountThenWeight((a, b) => a.objectId.localeCompare(b.objectId))),
    }),
  );
  objectTypes.sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.objectType.localeCompare(b.objectType),
  );

  return { windowStart, countsAvailable, users, objectTypes };
}
