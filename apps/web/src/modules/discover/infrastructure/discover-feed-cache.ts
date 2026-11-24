import type {
  DiscoverObjectsPage,
  DiscoverSectionsPage,
} from '../domain/discover-response.schema';
import type { DiscoverBox } from '../domain/discover-url';
import { createSessionLruCache } from './session-lru-cache';

const MAX_ENTRIES = 3;

const feedCache = createSessionLruCache<DiscoverObjectsPage>(MAX_ENTRIES);
const sectionsCache = createSessionLruCache<DiscoverSectionsPage>(MAX_ENTRIES);

export type DiscoverFeedCacheQuery = {
  objectType: string;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  /** Category lineage, in order (not sorted: the order is the lineage). */
  categoryPath: readonly string[];
};

export function discoverFeedCacheKey(query: DiscoverFeedCacheQuery): string {
  const box = query.box
    ? `${query.box.swLng},${query.box.swLat},${query.box.neLng},${query.box.neLat}`
    : '';
  return [
    query.objectType,
    query.q,
    [...query.tags].sort().join('\u0001'),
    query.sort,
    box,
    query.categoryPath.join('\u0001'),
  ].join('\u0002');
}

export function readDiscoverFeedCache(key: string): DiscoverObjectsPage | null {
  return feedCache.read(key);
}

export function writeDiscoverFeedCache(key: string, page: DiscoverObjectsPage): void {
  feedCache.write(key, page);
}

/** Category blocks depend only on the type and the lineage (no filters in block mode). */
export function discoverSectionsCacheKey(objectType: string, categoryPath: readonly string[]): string {
  return [objectType, categoryPath.join('\u0001')].join('\u0002');
}

export function readDiscoverSectionsCache(key: string): DiscoverSectionsPage | null {
  return sectionsCache.read(key);
}

export function writeDiscoverSectionsCache(key: string, page: DiscoverSectionsPage): void {
  sectionsCache.write(key, page);
}

export function clearDiscoverFeedCacheForTests(): void {
  feedCache.clear();
  sectionsCache.clear();
}
