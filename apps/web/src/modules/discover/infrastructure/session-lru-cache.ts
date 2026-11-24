/**
 * In-memory LRU for client-fetched Discover lists, kept for the browser session so a Back
 * navigation can seed the list (and its scroll offset) instead of refetching page one.
 */
export type SessionLruCache<T> = {
  read(key: string): T | null;
  write(key: string, value: T): void;
  clear(): void;
};

export function createSessionLruCache<T>(maxEntries: number): SessionLruCache<T> {
  const cache = new Map<string, T>();
  return {
    read(key) {
      const hit = cache.get(key);
      if (hit === undefined) {
        return null;
      }
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    },
    write(key, value) {
      cache.delete(key);
      cache.set(key, value);
      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        cache.delete(oldest);
      }
    },
    clear() {
      cache.clear();
    },
  };
}
