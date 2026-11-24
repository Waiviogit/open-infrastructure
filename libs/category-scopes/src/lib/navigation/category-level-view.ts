import { passesCategoryDisplayRules } from './category-display-rules';
import { ROOT_DEPARTMENTS_LIMIT } from './category-navigation.constants';
import type { CategoryNavigationRow } from './category-navigation.types';
import { greedyRootDepartments } from './level1-filter';

export type CategoryCountOf = (name: string) => number;

/** Names that pass the display rules against the level's `total`, by count DESC. */
export function filterShownCategories(
  names: readonly string[],
  countOf: CategoryCountOf,
  total: number,
): string[] {
  return names
    .filter((name) => passesCategoryDisplayRules(countOf(name), total))
    .sort((a, b) => countOf(b) - countOf(a));
}

export type RootCategorySelection = {
  /** Shown root categories, by count DESC, at most {@link ROOT_DEPARTMENTS_LIMIT}. */
  names: string[];
  /** More root categories exist than the limit. */
  showOther: boolean;
};

/**
 * Root level: the display rules, then greedy dominance among the names that passed (a hidden
 * catch-all category over 60% never suppresses the ones it co-occurs with), then the cap.
 */
export function selectRootCategories(
  navRows: readonly CategoryNavigationRow[],
  candidates: readonly string[],
  countOf: CategoryCountOf,
  total: number,
): RootCategorySelection {
  const shown = filterShownCategories(candidates, countOf, total);
  const rowByName = new Map(navRows.map((row) => [row.category_name, row]));
  const shownRows = shown.flatMap((name) => {
    const row = rowByName.get(name);
    return row ? [{ ...row, objects_count: countOf(name) }] : [];
  });
  const kept = greedyRootDepartments(shownRows).map((row) => row.category_name);
  return {
    names: kept.slice(0, ROOT_DEPARTMENTS_LIMIT),
    showOther: kept.length > ROOT_DEPARTMENTS_LIMIT,
  };
}
