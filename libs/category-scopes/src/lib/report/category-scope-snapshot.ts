import {
  TYPE_SCOPE_TOTAL_SENTINEL,
  UNCATEGORIZED_CATEGORY_SENTINEL,
} from '@opden-data-layer/core';
import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';

import {
  precomputedTypeTotal,
  selectCategoryCandidates,
  selectRootCategories,
  toCategoryNavigationRows,
} from '../navigation';

export type CategoryCount = { name: string; count: number };

/** One scope as stored, and the root level a client would see from it. */
export type CategoryScopeSnapshot = {
  /** Every stored category with its count (sentinels excluded), by count DESC then name. */
  stored: CategoryCount[];
  /** Units of the whole scope (uncategorized included); `null` when not derivable (global). */
  total: number | null;
  /** Root categories after the display rules, dominance and the cap; empty without a total. */
  visibleRoot: CategoryCount[];
  /** More root categories than the cap (`Other`). */
  showOther: boolean;
};

/**
 * Snapshot of one scope from its precomputed rows. The visible root uses the query-api root
 * algorithm with stored counts, which is what the unfiltered root shows right after a rebuild.
 */
export function snapshotCategoryScope(
  rows: readonly ObjectCategoriesRelatedRow[],
): CategoryScopeSnapshot {
  const navRows = toCategoryNavigationRows([...rows]);
  const stored = navRows
    .map((row) => ({ name: row.category_name, count: row.objects_count }))
    .sort(byCountThenName);
  const total = scopeUnitTotal(rows);
  if (total == null) {
    return { stored, total, visibleRoot: [], showOther: false };
  }
  const counts = new Map(stored.map((c) => [c.name, c.count]));
  const countOf = (name: string) => counts.get(name) ?? 0;
  const root = selectRootCategories(
    navRows,
    selectCategoryCandidates(navRows, [], []),
    countOf,
    total,
  );
  return {
    stored,
    total,
    visibleRoot: root.names.map((name) => ({ name, count: countOf(name) })),
    showOther: root.showOther,
  };
}

/**
 * Type scope: the `__total__` row. User scope: groups of every category (`group_keys`) plus the
 * uncategorized sentinel. Global scope stores neither, so `null`.
 */
function scopeUnitTotal(
  rows: readonly ObjectCategoriesRelatedRow[],
): number | null {
  const typeTotal = precomputedTypeTotal([...rows]);
  if (typeTotal != null) {
    return typeTotal;
  }
  if (rows.some((row) => row.scope_type !== 'user')) {
    return null;
  }
  const groups = new Set<string>();
  let uncategorized = 0;
  for (const row of rows) {
    if (row.category_name === UNCATEGORIZED_CATEGORY_SENTINEL) {
      uncategorized += Number(row.objects_count);
    } else if (row.category_name !== TYPE_SCOPE_TOTAL_SENTINEL) {
      for (const key of row.group_keys ?? []) {
        groups.add(key);
      }
    }
  }
  return groups.size + uncategorized;
}

function byCountThenName(a: CategoryCount, b: CategoryCount): number {
  return b.count - a.count || a.name.localeCompare(b.name);
}
