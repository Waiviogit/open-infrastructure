import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';
import {
  TYPE_SCOPE_TOTAL_SENTINEL,
  UNCATEGORIZED_CATEGORY_SENTINEL,
} from '@opden-data-layer/core';
import { filterSubDepartments } from './level2-filter';
import {
  toNavigationRow,
  type CategoryNavigationRow,
} from './category-navigation.types';

const SENTINELS: ReadonlySet<string> = new Set([
  UNCATEGORIZED_CATEGORY_SENTINEL,
  TYPE_SCOPE_TOTAL_SENTINEL,
]);

/** Precomputed related rows → navigation rows (sentinel rows dropped). */
export function toCategoryNavigationRows(
  rows: ObjectCategoriesRelatedRow[],
): CategoryNavigationRow[] {
  return rows
    .filter((row) => !SENTINELS.has(row.category_name))
    .map(toNavigationRow);
}

/** Every active group of a type scope (`__total__` row); `null` when the scope has none yet. */
export function precomputedTypeTotal(
  rows: ObjectCategoriesRelatedRow[],
): number | null {
  const total = rows.find(
    (row) => row.category_name === TYPE_SCOPE_TOTAL_SENTINEL,
  );
  return total ? Number(total.objects_count) : null;
}

/**
 * Candidate child names under `lineage`, chosen from precomputed rows only (root: every name, by
 * precomputed count; deeper: rows co-occurring with the whole ancestry). Candidates are not proof
 * that a non-empty intersection exists: callers apply live counts and the display rules, and at
 * the root greedy dominance among the names that pass (`greedyRootDepartments`).
 */
export function selectCategoryCandidates(
  navRows: CategoryNavigationRow[],
  lineage: readonly string[],
  excluded: readonly string[],
): string[] {
  const names =
    lineage.length === 0
      ? [...navRows]
          .sort((a, b) => b.objects_count - a.objects_count)
          .map((row) => row.category_name)
      : filterSubDepartments({
          allRows: navRows,
          path: lineage.slice(0, -1),
          name: lineage[lineage.length - 1] ?? '',
          excluded: [...excluded],
        }).map((row) => row.category_name);
  return names.filter(
    (name) => !lineage.includes(name) && !excluded.includes(name),
  );
}
