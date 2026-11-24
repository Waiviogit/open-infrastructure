import { NEAR_DUPLICATE_TOLERANCE } from './category-navigation.constants';
import type { CategoryNavigationRow } from './category-navigation.types';

/**
 * Level ≥2 candidates under `name`: rows whose `related_names` contain the whole ancestry
 * (`path` + `name`). Counts and the display rules are applied later on live counts.
 */
export function filterSubDepartments(params: {
  allRows: CategoryNavigationRow[];
  path: string[];
  name: string;
  excluded: string[];
}): CategoryNavigationRow[] {
  const { allRows, path, name, excluded } = params;
  const ancestry = [...path, name];
  return allRows
    .filter(
      (d) =>
        d.category_name !== name &&
        !excluded.includes(d.category_name) &&
        ancestry.every((a) => d.related_names.includes(a)),
    )
    .sort((a, b) => b.objects_count - a.objects_count);
}

/**
 * Near-duplicate test on unit counts: `a` and `b` (with `both` units in common) each have fewer
 * than {@link NEAR_DUPLICATE_TOLERANCE} units outside the other, and the common part is the
 * majority of each. The majority condition keeps two small, mostly disjoint categories (a few
 * units each) apart: with the 3-unit display minimum they are always under the tolerance.
 */
export function isNearDuplicateByCounts(a: number, b: number, both: number): boolean {
  return (
    2 * both > a &&
    2 * both > b &&
    a - both < NEAR_DUPLICATE_TOLERANCE &&
    b - both < NEAR_DUPLICATE_TOLERANCE
  );
}

/** Near-duplicate test on precomputed `group_keys` (user scopes store them). */
export function isNearDuplicateByGroupKeys(aKeys: readonly string[], bKeys: readonly string[]): boolean {
  const bs = new Set(bKeys);
  const both = aKeys.filter((key) => bs.has(key)).length;
  return isNearDuplicateByCounts(aKeys.length, bKeys.length, both);
}
