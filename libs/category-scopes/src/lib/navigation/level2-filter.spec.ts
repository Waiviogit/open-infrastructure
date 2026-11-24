import {
  filterSubDepartments,
  isNearDuplicateByCounts,
  isNearDuplicateByGroupKeys,
} from './level2-filter';
import type { CategoryNavigationRow } from './category-navigation.types';

function nav(
  name: string,
  count: number,
  related: string[],
): CategoryNavigationRow {
  return {
    category_name: name,
    objects_count: count,
    group_keys: [],
    related_names: related,
    related_counts: [],
  };
}

describe('filterSubDepartments', () => {
  it('returns empty when no candidate lists the parent in related_names', () => {
    expect(
      filterSubDepartments({
        allRows: [nav('Child', 50, [])],
        path: [],
        name: 'Parent',
        excluded: [],
      }),
    ).toEqual([]);
  });

  it('keeps every row co-occurring with the whole ancestry, by precomputed count', () => {
    const rows = [
      nav('Small', 5, ['Root', 'Parent']),
      nav('Only parent', 80, ['Parent']),
      nav('Big', 90, ['Root', 'Parent']),
      nav('Excluded', 70, ['Root', 'Parent']),
    ];

    const names = filterSubDepartments({
      allRows: rows,
      path: ['Root'],
      name: 'Parent',
      excluded: ['Excluded'],
    }).map((row) => row.category_name);

    // No share or size thresholds here: the display rules run on live counts.
    expect(names).toEqual(['Big', 'Small']);
  });
});

describe('near-duplicate tests', () => {
  it('counts: duplicates when each side has fewer than 10 units outside the other', () => {
    expect(isNearDuplicateByCounts(20, 18, 17)).toBe(true);
    expect(isNearDuplicateByCounts(30, 18, 18)).toBe(false);
    expect(isNearDuplicateByCounts(20, 12, 2)).toBe(false);
  });

  it('counts: small disjoint or mostly disjoint categories are never duplicates', () => {
    expect(isNearDuplicateByCounts(6, 4, 0)).toBe(false);
    expect(isNearDuplicateByCounts(6, 4, 2)).toBe(false);
    expect(isNearDuplicateByCounts(6, 5, 5)).toBe(true);
  });

  it('group keys: same rule on the key sets', () => {
    const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
    expect(isNearDuplicateByGroupKeys(keys, keys.slice(0, 15))).toBe(true);
    expect(isNearDuplicateByGroupKeys(keys, keys.slice(0, 5))).toBe(false);
  });
});
