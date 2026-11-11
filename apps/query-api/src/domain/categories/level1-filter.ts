import type { CategoryNavigationRow } from './category-navigation.types';

/**
 * Root candidates: sort by precomputed `objects_count` DESC and greedily suppress names
 * dominated by a stronger accepted row (`related_names`). No cap — the caller caps after
 * dropping names whose live count is 0.
 */
export function greedyRootDepartments(rows: CategoryNavigationRow[]): CategoryNavigationRow[] {
  const sorted = [...rows].sort((a, b) => b.objects_count - a.objects_count);
  const accepted: CategoryNavigationRow[] = [];
  for (const cat of sorted) {
    const dominated = accepted.some((acc) => acc.related_names.includes(cat.category_name));
    if (!dominated) {
      accepted.push(cat);
    }
  }
  return accepted;
}
