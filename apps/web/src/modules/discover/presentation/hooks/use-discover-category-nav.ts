'use client';

import { useEffect, useState } from 'react';

import type { CategoryNavItem } from '@/shared/domain/category-nav';

import type { DiscoverBox } from '../../domain/discover-url';
import { fetchDiscoverCategories } from '../../infrastructure/discover.client';

export type DiscoverCategoryNavState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      items: CategoryNavItem[];
      /** Lineage whose children `items` are (the parent of a leaf). */
      navLineage: string[];
    };

export type UseDiscoverCategoryNavParams = {
  /** Category object type; `null` turns the hook off (no tree). */
  objectType: string | null;
  categoryPath: readonly string[];
  q: string;
  tags: readonly string[];
  box: DiscoverBox | null;
};

/**
 * One level of the Discover category tree for the current URL. A leaf (no child categories)
 * shows its siblings, so the open category stays visible and highlighted.
 */
export function useDiscoverCategoryNav({
  objectType,
  categoryPath,
  q,
  tags,
  box,
}: UseDiscoverCategoryNavParams): DiscoverCategoryNavState {
  const [state, setState] = useState<DiscoverCategoryNavState>({ status: 'loading' });
  const pathKey = categoryPath.join('\u0001');
  const tagsKey = tags.join('\u0001');

  useEffect(() => {
    if (objectType == null) {
      setState({ status: 'ready', items: [], navLineage: [] });
      return;
    }
    const ac = new AbortController();
    const lineage = pathKey.length > 0 ? pathKey.split('\u0001') : [];
    const filters = {
      q: q.trim() || undefined,
      tags: tagsKey.length > 0 ? tagsKey.split('\u0001') : [],
      box: box ?? undefined,
      signal: ac.signal,
    };
    setState({ status: 'loading' });

    void (async () => {
      const level = await fetchDiscoverCategories(objectType, { ...filters, categoryPath: lineage });
      if (ac.signal.aborted) {
        return;
      }
      if (level === null) {
        setState({ status: 'error' });
        return;
      }
      if (level.items.length > 0 || lineage.length === 0) {
        setState({ status: 'ready', items: level.items, navLineage: lineage });
        return;
      }
      const parentLineage = lineage.slice(0, -1);
      const parent = await fetchDiscoverCategories(objectType, {
        ...filters,
        categoryPath: parentLineage,
      });
      if (ac.signal.aborted) {
        return;
      }
      setState(
        parent
          ? { status: 'ready', items: parent.items, navLineage: parentLineage }
          : { status: 'ready', items: [], navLineage: lineage },
      );
    })();

    return () => ac.abort();
  }, [objectType, pathKey, q, tagsKey, box]);

  return state;
}
