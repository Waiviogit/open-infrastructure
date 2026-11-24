'use client';

import { useEffect, useRef, useState } from 'react';

import type { CategoryNavItem } from '@/shared/domain/category-nav';

import type { DiscoverBox } from '../../domain/discover-url';
import { fetchDiscoverCategories } from '../../infrastructure/discover.client';

export type DiscoverCategoryNavState =
  /**
   * `treeKnown`: the previous answer was a tree of this same type (the rail is on screen), so the
   * rail keeps its frame (skeleton) while the level reloads. Otherwise nothing is drawn until the
   * answer says whether the type has categories.
   */
  | { status: 'loading'; treeKnown: boolean }
  | { status: 'error'; treeKnown: boolean }
  | {
      status: 'ready';
      items: CategoryNavItem[];
      /** Lineage whose children `items` are (the parent of a leaf). */
      navLineage: string[];
      /** Groups of `navLineage` in none of `items` (its Other category); 0 at the type root. */
      otherCount: number;
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
  const [state, setState] = useState<DiscoverCategoryNavState>({
    status: 'loading',
    treeKnown: false,
  });
  /** Type of the previous answer when it had a tree (categories, or a category lineage). */
  const treeTypeRef = useRef<string | null>(null);
  const pathKey = categoryPath.join('\u0001');
  const tagsKey = tags.join('\u0001');

  useEffect(() => {
    if (objectType == null) {
      setState({ status: 'ready', items: [], navLineage: [], otherCount: 0 });
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
    const treeKnown = treeTypeRef.current === objectType;
    setState({ status: 'loading', treeKnown });
    const settle = (items: CategoryNavItem[], navLineage: string[], otherCount: number) => {
      treeTypeRef.current = items.length > 0 || navLineage.length > 0 ? objectType : null;
      setState({ status: 'ready', items, navLineage, otherCount });
    };

    void (async () => {
      const level = await fetchDiscoverCategories(objectType, { ...filters, categoryPath: lineage });
      if (ac.signal.aborted) {
        return;
      }
      if (level === null) {
        setState({ status: 'error', treeKnown });
        return;
      }
      if (level.items.length > 0 || lineage.length === 0) {
        settle(level.items, lineage, level.other_count);
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
      if (parent) {
        settle(parent.items, parentLineage, parent.other_count);
      } else {
        settle([], lineage, 0);
      }
    })();

    return () => ac.abort();
  }, [objectType, pathKey, q, tagsKey, box]);

  return state;
}

/**
 * Whether the category tree (rail, crumbs, drawer) is drawn. It appears once the answer says the
 * type has categories, so there is no skeleton that then vanishes; a category lineage in the URL,
 * or a tree already on screen for the type, keeps it while a level reloads.
 */
export function isDiscoverCategoryTreeVisible(
  nav: DiscoverCategoryNavState,
  categoryPath: readonly string[],
): boolean {
  if (categoryPath.length > 0) {
    return true;
  }
  return nav.status === 'ready' ? nav.items.length > 0 : nav.treeKnown;
}
