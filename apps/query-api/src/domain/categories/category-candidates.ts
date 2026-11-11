import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';
import { UNCATEGORIZED_CATEGORY_SENTINEL } from '@opden-data-layer/core';
import { greedyRootDepartments } from './level1-filter';
import { filterSubDepartments } from './level2-filter';
import { toNavigationRow, type CategoryNavigationRow } from './category-navigation.types';

/** Precomputed related rows → navigation rows (uncategorized sentinel dropped). */
export function toCategoryNavigationRows(rows: ObjectCategoriesRelatedRow[]): CategoryNavigationRow[] {
  return rows
    .filter((row) => row.category_name !== UNCATEGORIZED_CATEGORY_SENTINEL)
    .map(toNavigationRow);
}

/**
 * Ordered candidate child names under `lineage`, chosen from precomputed rows only
 * (root: greedy dominance; deeper: level-2 heuristics). Candidates are not proof that a
 * non-empty intersection exists — callers confirm with a live count.
 */
export function selectCategoryCandidates(
  navRows: CategoryNavigationRow[],
  lineage: readonly string[],
  excluded: readonly string[],
): string[] {
  const names =
    lineage.length === 0
      ? greedyRootDepartments(navRows).map((row) => row.category_name)
      : filterSubDepartments({
          allRows: navRows,
          path: lineage.slice(0, -1),
          name: lineage[lineage.length - 1] ?? '',
          excluded: [...excluded],
        }).map((row) => row.category_name);
  return names.filter((name) => !lineage.includes(name) && !excluded.includes(name));
}
